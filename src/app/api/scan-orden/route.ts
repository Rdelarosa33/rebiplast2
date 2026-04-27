import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

const PROMPT = `Lee esta orden de trabajo automotriz peruana desde la imagen.

Devuelve SOLO JSON válido sin markdown ni explicaciones.

DATOS A EXTRAER (algunos ya vienen pre-detectados, completa los que falten):
- numero_siniestro, numero_orden, marca, placa, color
- tipo_seguro (si viene null: RIMAC/MAPFRE/PACIFICO/LA_POSITIVA/HDI/INTERSEGURO/TALLER/OTRO)
- nombre_girador (si viene null: buscar junto a Tecnico/Perito/Asesor/Realizado por/VoBo/firma)
- taller_origen (si viene null: buscar TALLER PRINCIPAL/ATENCION A TALLER/Cliente/"a los señores"/firma empresa - IGNORAR REBIPLAST)
- piezas

PLACA: Formato ABC123 o ABC1234. Buscar cerca de VIN, Marca, Modelo, Rodaje. Si hay valor probable usarlo.

PIEZAS - CADA linea = UNA pieza separada. NO agrupar:
- MAPFRE: cada linea REP = pieza independiente
- RIMAC: cada fila descripcion/SERVICIO = una pieza
- LA_POSITIVA: tabla Reparacion/Descripcion, cada fila = una pieza  
- PACIFICO/EA Corp: tabla OPERACION/DESCRIPCION, cada fila = una pieza
- INTERSEGURO: piezas en Observaciones, separar por coma/guion/salto

Para cada pieza:
- nombre: texto descriptivo
- lado: LH/IZQ=Izquierdo, RH/DER=Derecho, DEL/DELT=Frontal, POST=Posterior, sino N/A
- requiere_reparacion: si REP/REPARA/REPARAR
- requiere_pintura: si PINTURA/PINTAR/RP
- es_faro: si FARO/NEBLINERO/LUZ
- requiere_pulido: si PULIDO o es_faro sin cambio/reemplazo
- tipo_trabajo: RP/R/P/PU

Ignorar: SUBTOTAL, IGV, TOTAL, filas vacias.

JSON RESPUESTA:
{"numero_siniestro":null,"numero_orden":null,"marca":null,"placa":null,"tipo_seguro":null,"nombre_girador":null,"taller_origen":null,"color":null,"piezas":[{"nombre":"","lado":"N/A","requiere_reparacion":false,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":null}]}`

function limpiarJSON(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

function normalizarTexto(t: string): string {
  return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

async function buscarEnReferencias(textoImagen: string, supabase: any) {
  const texto = normalizarTexto(textoImagen)
  let tipo_seguro = null
  let nombre_girador = null
  let taller_origen = null

  // 1. Buscar aseguradora
  const { data: aseguradoras } = await supabase.from('ref_aseguradoras').select('variante, tipo')
  if (aseguradoras) {
    for (const a of aseguradoras) {
      if (texto.includes(normalizarTexto(a.variante))) {
        tipo_seguro = a.tipo
        break
      }
    }
  }

  // 2. Buscar girador
  const { data: giradores } = await supabase.from('ref_giradores').select('nombre, aseguradora')
  if (giradores) {
    // Ordenar por longitud descendente para preferir coincidencias más específicas
    const sorted = giradores.sort((a: any, b: any) => b.nombre.length - a.nombre.length)
    for (const g of sorted) {
      if (texto.includes(normalizarTexto(g.nombre))) {
        nombre_girador = g.nombre
        if (!tipo_seguro && g.aseguradora !== 'TALLER') tipo_seguro = g.aseguradora
        break
      }
    }
  }

  // 3. Buscar taller
  const { data: talleres } = await supabase.from('ref_talleres').select('nombre')
  if (talleres) {
    const sorted = talleres.sort((a: any, b: any) => b.nombre.length - a.nombre.length)
    for (const t of sorted) {
      if (texto.includes(normalizarTexto(t.nombre))) {
        taller_origen = t.nombre
        break
      }
    }
  }

  return { tipo_seguro, nombre_girador, taller_origen }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('imagen') as File
    if (!file) return NextResponse.json({ error: 'No se recibio imagen' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Paso 1: GPT lee la imagen y extrae todo
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1200,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${file.type};base64,${base64}`, detail: 'high' }
            },
            { type: 'text', text: PROMPT }
          ]
        }]
      })
    })

    const result = await res.json()
    if (result.error) throw new Error(result.error.message)

    const jsonText = limpiarJSON(result.choices?.[0]?.message?.content || '')
    const data = JSON.parse(jsonText)

    // Paso 2: Enriquecer con tablas de referencia usando el texto extraído por GPT
    // Usamos los campos de texto del JSON como base de búsqueda
    const textoBusqueda = [
      data.tipo_seguro, data.nombre_girador, data.taller_origen,
      data.numero_siniestro, data.numero_orden, data.marca, data.placa
    ].filter(Boolean).join(' ')

    const refs = await buscarEnReferencias(textoBusqueda, supabase)

    // Paso 3: Las referencias tienen prioridad sobre lo que detectó GPT
    if (refs.tipo_seguro) data.tipo_seguro = refs.tipo_seguro
    if (refs.nombre_girador) data.nombre_girador = refs.nombre_girador
    if (refs.taller_origen) data.taller_origen = refs.taller_origen

    // Registrar uso y descontar credito
    try {
      const COSTO = 0.50
      const { data: cred } = await supabase.from('creditos_ocr').select('id, saldo').single()
      if (cred && cred.saldo < COSTO) {
        return NextResponse.json({ error: 'Saldo OCR insuficiente. Recarga tus créditos.' }, { status: 402 })
      }
      if (cred) {
        await supabase.from('creditos_ocr')
          .update({ saldo: cred.saldo - COSTO, updated_at: new Date().toISOString() })
          .eq('id', cred.id)
      }
      await supabase.from('uso_ocr').insert({
        seguro_detectado: data.tipo_seguro,
        piezas_extraidas: data.piezas?.length || 0,
        numero_siniestro: data.numero_siniestro,
        costo: COSTO,
        exitoso: true,
      })
    } catch (e) {
      console.error('Error registrando uso OCR:', e)
    }

    return NextResponse.json({ success: true, data, proveedor: 'gpt-4o-mini+refs' })

  } catch (error: any) {
    console.error('Error scan-orden:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar' }, { status: 500 })
  }
}
