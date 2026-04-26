import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ================================================
// CONFIGURACIÓN: elige qué proveedor usar
// ================================================
const USE_GOOGLE_VISION = true
const USE_CLAUDE = false
const USE_OPENAI = false
// ================================================

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

async function procesarConGoogleVision(base64: string) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) throw new Error('GOOGLE_VISION_API_KEY no configurada')

  const visionRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: base64 }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }]
      })
    }
  )
  const visionData = await visionRes.json()
  if (visionData.error) throw new Error(visionData.error.message)
  const textoExtraido = visionData.responses?.[0]?.fullTextAnnotation?.text || ''
  if (!textoExtraido) throw new Error('No se pudo extraer texto de la imagen')

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{ role: 'user', content: `${PROMPT}\n\nTexto extraído:\n${textoExtraido}` }]
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

async function procesarConClaude(base64: string, mediaType: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as any, data: base64 } },
        { type: 'text', text: PROMPT }
      ]
    }]
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

async function procesarConOpenAI(base64: string, mediaType: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}`, detail: 'high' } },
          { type: 'text', text: PROMPT }
        ]
      }]
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const text = data.choices?.[0]?.message?.content || ''
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('imagen') as File
    if (!file) return NextResponse.json({ error: 'No se recibio imagen' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type

    let jsonText = ''
    let proveedor = ''

    if (USE_GOOGLE_VISION) {
      jsonText = await procesarConGoogleVision(base64)
      proveedor = 'google'
    } else if (USE_OPENAI) {
      jsonText = await procesarConOpenAI(base64, mediaType)
      proveedor = 'openai'
    } else if (USE_CLAUDE) {
      jsonText = await procesarConClaude(base64, mediaType)
      proveedor = 'claude'
    } else {
      return NextResponse.json({ error: 'No hay proveedor configurado' }, { status: 500 })
    }

    const data = JSON.parse(jsonText)
    return NextResponse.json({ success: true, data, proveedor })

  } catch (error: any) {
    console.error('Error scan-orden:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar' }, { status: 500 })
  }
}
