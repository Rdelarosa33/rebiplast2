import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// ================================================
// CONFIGURACIÓN: elige qué proveedor usar
// ================================================
const USE_GOOGLE_VISION = true
const USE_CLAUDE = false
const USE_OPENAI = false
// ================================================

const PROMPT = `Eres un experto en leer órdenes de trabajo de talleres automotrices peruanos.
Analiza esta imagen y extrae los datos. Sigue el mapeo exacto por seguro.

========================
PASO 1: DETECTAR SEGURO
========================
Busca estos logos o palabras en la imagen:
- "RIMAC" → tipo_seguro = RIMAC
- "MAPFRE" → tipo_seguro = MAPFRE
- "La Positiva" o "LA POSITIVA" → tipo_seguro = LA_POSITIVA
- "Pacífico" o "PACIFICO" o "EA Corp" o "Alpiconsult" → tipo_seguro = PACIFICO
- "INTERSEGURO" o "Qualität" o "AUTOLAND" → tipo_seguro = INTERSEGURO
- "HDI" → tipo_seguro = HDI
- Si no hay seguro reconocible → tipo_seguro = TALLER

========================
PASO 2: EXTRAER GIRADOR
========================
Busca CUALQUIERA de estas palabras clave en TODO el documento y extrae el nombre
que esté al lado o debajo. El primero que encuentres es el girador:

  "Técnico" / "TÉCNICO"
  "Técnico Siniestros" / "TÉCNICO SINIESTROS"
  "Técnico de Vehículos"
  "Perito" / "PERITO"
  "Asesor" / "ASESOR"
  "Asesor Técnico"
  "Ajustador" / "AJUSTADOR"
  "Nombre Usuario" / "NOMBRE USUARIO"
  "Realizado por" / "REALIZADO POR"
  "Jefe de Siniestros"
  "Jefe de Taller"
  "Inspector"
  "Liquidador"
  "Autorizado por"
  "VoBo" (el nombre o firma al lado)

EXCEPCIÓN: Si el seguro es INTERSEGURO → girador = "José Fernández" siempre.

========================
 (si no identificaste el seguro o no encontraste el girador)
========================
Si el tipo_seguro es OTRO o el nombre_girador sigue en null, busca CUALQUIERA de estas
palabras clave en TODO el documento y extrae el nombre que esté al lado o debajo:

Palabras clave para girador (en cualquier seguro):
  "Técnico" / "TÉCNICO"
  "Perito" / "PERITO"
  "Asesor" / "ASESOR"
  "Ajustador" / "AJUSTADOR"
  "Nombre Usuario" / "NOMBRE USUARIO"
  "Realizado por" / "REALIZADO POR"
  "Jefe de Siniestros"
  "Jefe de Taller"
  "Asesor Técnico"
  "Técnico de Vehículos"
  "Técnico Siniestros"
  "Inspector"
  "Liquidador"
  "Responsable"
  "Autorizado por"
  "VoBo" (la firma o nombre al lado)

Palabras clave para taller origen (en cualquier seguro):
  "Atención a Taller" / "ATENCIÓN A TALLER"
  "Taller Principal" / "TALLER PRINCIPAL"
  "Cliente:" (cuando es taller concesionario)
  "Sede:" o "SEDE"
  "a los señores [NOMBRE]"
  "Proveedor:" cuando no es Rebiplast

========================
PASO 5: EXTRAER PIEZAS
========================
Busca la sección de trabajos/servicios y extrae cada pieza:

RIMAC formato 1: tabla con columnas Item/Cantidad/Descripción
  - Cada fila con descripción es una pieza
  - "REPARA", "REPARAR" → requiere_reparacion=true, tipo_trabajo="R"

RIMAC formato 2: tabla con columnas CÓDIGO/DESCRIPCIÓN
  - Filas con "SERVICIO" en CÓDIGO → la DESCRIPCIÓN es la pieza
  - "REPARACION DE..." → tipo_trabajo="R"
  - "REPARACION Y PINTURA DE..." → tipo_trabajo="RP", requiere_pintura=true

MAPFRE: tabla "DESCRIPCIÓN Y EVALUACIÓN DE DAÑOS"
  - Filas con "REP" al inicio → cada línea REP es una pieza separada
  - Ejemplo: "REP FUNDA DEL" y "REP REJILLA DEL" son 2 piezas diferentes

LA POSITIVA: tabla "Cambio/Reparacion por" + "Descripción"
  - La descripción después de "Reparación /" es la pieza
  - Si dice "+ Pintura" → requiere_pintura=true

PACIFICO (EA Corp): tabla "OPERACION/DESCRIPCION"
  - Cada fila es una pieza
  - "Reparacion" al final → tipo_trabajo="R"
  - "Pintura" al final → tipo_trabajo="RP"

INTERSEGURO (Qualität): campo "Observaciones"
  - "OT POR REPUESTO : FUNDA POST SUP" → pieza = "FUNDA POST SUP"

REGLAS GENERALES PARA PIEZAS:
  - LH = lado Izquierdo, RH = lado Derecho
  - DELT o DELANTERA = Frontal, POST o POSTERIOR = Posterior
  - FARO, NEBLINERO, FARO DELANTERO = es_faro=true
  - IGNORAR filas de SUBTOTAL, IGV, TOTAL, filas vacías

========================
FORMATO DE RESPUESTA
========================
Devuelve SOLO este JSON sin markdown ni explicaciones:
{
  "numero_siniestro": null,
  "numero_orden": null,
  "expediente": null,
  "poliza": null,
  "placa": null,
  "marca": null,
  "modelo": null,
  "anio": null,
  "color": null,
  "vin": null,
  "nombre_asegurado": null,
  "telefono_asegurado": null,
  "tipo_seguro": "RIMAC|PACIFICO|MAPFRE|LA_POSITIVA|HDI|INTERSEGURO|TALLER|OTRO",
  "nombre_girador": null,
  "taller_origen": null,
  "fecha_recojo": null,
  "observaciones": null,
  "piezas": [
    {
      "nombre": "nombre de la pieza",
      "lado": "Izquierdo|Derecho|Frontal|Posterior|N/A",
      "color": null,
      "requiere_reparacion": true,
      "requiere_pintura": false,
      "es_faro": false,
      "requiere_pulido": false,
      "tipo_trabajo": "R|RP",
      "precio": null
    }
  ]
}`

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
    max_tokens: 2000,
    messages: [{ role: 'user', content: `${PROMPT}\n\nTexto extraído de la orden:\n\n${textoExtraido}` }]
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

async function procesarConClaude(base64: string, mediaType: string) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
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
      max_tokens: 2000,
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
