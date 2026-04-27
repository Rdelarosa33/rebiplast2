import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient as createSupabase } from '@supabase/supabase-js'

const PROMPT = `Extrae datos de esta orden de trabajo de taller automotriz peruano. Responde SOLO con JSON.

SEGUROS: RIMAC, MAPFRE, PACIFICO(o EA Corp), LA_POSITIVA, HDI, INTERSEGURO(o Qualität), TALLER, OTRO

GIRADOR - busca nombre junto a estas palabras:
Técnico, Perito, Asesor, Ajustador, Inspector, Liquidador, Realizado por, Jefe de Siniestros, Jefe de Taller, Nombre Usuario, VoBo, Autorizado por
EXCEPCIÓN: INTERSEGURO → girador = "José Fernández" siempre.

TALLER ORIGEN - busca junto a: Atención a Taller, Taller Principal, Cliente, Sede, "a los señores"

NÚMERO DE ORDEN por seguro:
- RIMAC fmt1: campo "N°" al inicio | fmt2: "NRO DE OC"
- MAPFRE: número después de "ORDEN DE TRABAJO"
- LA POSITIVA: "N° OC"
- PACIFICO: "NumOS" o "ORDEN DE TRABAJO Nro."
- INTERSEGURO: "ORDEN DE TRABAJO No."

PLACA: buscar en "Placa", "Rodaje", "PLACA"
SINIESTRO: buscar en "Siniestro", "SINIESTRO", "CASO"

PIEZAS - extrae cada servicio:
- "REP", "REPARA", "REPARAR", "REPARACION" → requiere_reparacion=true, tipo="R"
- "PINTURA", "+ Pintura", "RP" → requiere_pintura=true, tipo="RP"
- LH=Izquierdo, RH=Derecho, DELT=Frontal, POST=Posterior
- FARO, NEBLINERO → es_faro=true
- Ignorar subtotales, IGV, totales, filas vacías
- MAPFRE: cada línea "REP xxx" es una pieza separada
- INTERSEGURO: pieza está en campo "Observaciones"

{"numero_siniestro":null,"numero_orden":null,"expediente":null,"poliza":null,"placa":null,"marca":null,"modelo":null,"anio":null,"color":null,"vin":null,"nombre_asegurado":null,"telefono_asegurado":null,"tipo_seguro":"RIMAC","nombre_girador":null,"taller_origen":null,"fecha_recojo":null,"observaciones":null,"piezas":[{"nombre":"","lado":"N/A","color":null,"requiere_reparacion":true,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":"R","precio":null}]}`

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

    // GPT-4o-mini lee la imagen directamente
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
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${file.type};base64,${base64}`,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: PROMPT
              }
            ]
          }
        ]
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
