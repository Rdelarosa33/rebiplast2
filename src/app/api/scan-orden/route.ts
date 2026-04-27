import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

const PROMPT = `Lee esta orden de trabajo automotriz peruana desde la imagen.

Devuelve SOLO JSON válido sin markdown ni explicaciones.

========================
DATOS OBLIGATORIOS
========================
Extrae siempre: numero_siniestro, numero_orden, marca, placa, tipo_seguro, nombre_girador, taller_origen, color, piezas.
No inventar datos. Si existe un valor probable usalo. Solo null si no existe nada , en ningun caso el valor puede ser rafael Gonzales ni Rebiplast.

========================
DETECTAR SEGURO
========================
RIMAC, MAPFRE, PACIFICO, LA_POSITIVA, INTERSEGURO. si no se encuentra poner nombre de taller.

========================
NUMERO ORDEN
========================
Buscar: NRO DE OC, ORDEN DE TRABAJO, OC-, NumOS, N°, Folio

========================
PLACA (CRITICA)
========================
Buscar en TODO el documento. Formato ABC123 o ABC-123. Cerca de VIN, Marca, Modelo, Rodaje. Si hay valor probable usarlo.

========================
GIRADOR
========================
Buscar nombre junto a: Tecnico, Perito, Asesor, Ajustador, Inspector, Responsable, Autorizado, VoBo, Realizado por, Nombre Usuario, firma.

========================
TALLER ORIGEN
========================
Prioridad: TALLER PRINCIPAL > ATENCION A TALLER > Cliente > "a los señores" > firma empresa inferior.
IGNORAR REBIPLAST o Rafael Gonzales.

========================
PIEZAS - SEPARACION OBLIGATORIA
========================
CADA linea de trabajo = UNA pieza separada. NO agrupar jamas.

MAPFRE: cada linea REP = pieza independiente
  REP FUNDA DEL = pieza 1
  REP REJILLA DEL = pieza 2

RIMAC: cada fila descripcion o SERVICIO = una pieza

LA_POSITIVA: tabla Reparacion/Descripcion, cada fila = una pieza

PACIFICO/EA Corp: tabla OPERACION/DESCRIPCION, cada fila = una pieza

INTERSEGURO: piezas en Observaciones, separar por coma/guion/salto de linea

Para cada pieza:
- nombre: texto descriptivo
- lado: LH/IZQ=Izquierdo, RH/DER=Derecho, DEL/DELT=Frontal, POST=Posterior, sino N/A
- requiere_reparacion: si REP/REPARA/REPARAR
- requiere_pintura: si PINTURA/PINTAR/RP
- es_faro: si FARO/NEBLINERO/LUZ
- requiere_pulido: si PULIDO o es_faro sin cambio/reemplazo
- tipo_trabajo: RP=reparacion+pintura, R=solo rep, P=solo pintura, PU=solo pulido

Ignorar: SUBTOTAL, IGV, TOTAL, filas vacias.

========================
JSON RESPUESTA
========================
{"numero_siniestro":null,"numero_orden":null,"marca":null,"placa":null,"tipo_seguro":null,"nombre_girador":null,"taller_origen":null,"color":null,"piezas":[{"nombre":"","lado":"N/A","requiere_reparacion":false,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":null}]}`

function limpiarJSON(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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
              image_url: {
                url: `data:${file.type};base64,${base64}`,
                detail: 'high'
              }
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

    // Registrar uso y descontar credito
    try {
      const supabase = createSupabase(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
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

    return NextResponse.json({ success: true, data, proveedor: 'gpt-4o-mini' })

  } catch (error: any) {
    console.error('Error scan-orden:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar' }, { status: 500 })
  }
}
