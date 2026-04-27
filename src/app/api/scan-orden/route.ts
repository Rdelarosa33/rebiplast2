import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

const PROMPT = `Lee esta orden de trabajo automotriz peruana desde una imagen.

Si la imagen es grande o pesada, analiza toda la información visible y enfócate en las zonas con mayor concentración de texto. Si es necesario, interpreta incluso texto borroso o de baja calidad.

Devuelve SOLO JSON válido.

========================
CAMPOS CRÍTICOS (OBLIGATORIOS)
========================
Debes intentar encontrar SI O SI:
- numero_siniestro, numero_orden, marca, placa, tipo_seguro, nombre_girador, taller_origen, color, piezas

IMPORTANTE:
- No inventar datos
- Si existe un valor probable, úsalo
- Solo usar null si NO existe nada parecido en el documento

========================
DETECTAR SEGURO
========================
- RIMAC → si aparece RIMAC
- MAPFRE → si aparece MAPFRE
- PACIFICO → si aparece Pacífico o EA Corp
- LA_POSITIVA → si aparece La Positiva
- INTERSEGURO → si aparece Qualitat, Interseguro
- OTRO → si no

========================
NUMERO ORDEN
========================
Buscar: NRO DE OC, ORDEN DE TRABAJO, OC-, NumOS, N°

========================
SINIESTRO
========================
Buscar: Siniestro, Caso, Número de caso

========================
PLACA (MUY IMPORTANTE)
========================
Buscar en TODO el documento. Formato: 3 letras + 3-4 números (ABC123).
Suele estar cerca de: VIN, Marca, Modelo, Rodaje.
Si encuentras un valor probable úsalo aunque esté poco claro.

========================
GIRADOR (PRIORIDAD)
========================
Buscar nombre junto a: Técnico, Realizado por, Asesor, Inspector, Jefe de Taller, Autorizado, VoBo, Firma con nombre debajo.
Elegir el nombre más claro.

========================
TALLER_ORIGEN (CRÍTICO)
========================
Buscar en este orden:
1. TALLER PRINCIPAL
2. ATENCIÓN A TALLER
3. Cliente
4. Texto después de "a los señores"
5. Empresa en firma inferior

REGLAS:
- IGNORAR "REBIPLAST"
- Elegir el taller que envía el trabajo
- Preferir empresa sobre persona

========================
EXTRACCIÓN DE PIEZAS
========================
Cada línea de trabajo/servicio es una pieza independiente.

Para cada pieza:
- nombre: texto descriptivo (combinar si es muy corto)
- lado: LH/IZQ=Izquierdo, RH/DER=Derecho, DEL/DELT=Frontal, POST=Posterior, sino N/A
- requiere_reparacion: si dice REP, REPARA, REPARAR, REPARACIÓN
- requiere_pintura: si dice PINTURA, PINTAR, RP
- es_faro: si dice FARO, NEBLINERO, LUZ
- requiere_pulido: si dice PULIDO o es faro sin cambio/reemplazo
- tipo_trabajo: RP=reparación+pintura, R=solo reparación, P=solo pintura, PU=solo pulido

REGLAS: No agrupar piezas. Ignorar SUBTOTAL, IGV, TOTAL.

========================
FORMATO JSON (responde SOLO esto)
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
