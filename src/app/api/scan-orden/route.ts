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
Analiza esta imagen y extrae los datos según el formato del documento.

========================
IDENTIFICAR FORMATO
========================
Detecta el logo o nombre del seguro: RIMAC, MAPFRE, PACIFICO, LA_POSITIVA, HDI, INTERSEGURO, TALLER

========================
MAPEO DE CAMPOS POR SEGURO
========================

RIMAC — hay DOS formatos:
Formato 1 (Orden de compra simple):
  - N° Siniestro: campo "Siniestro N°"
  - N° Orden: campo "N°" al inicio del documento (ej: 60349)
  - Póliza: campo "Póliza N°"
  - Placa: campo "Rodaje"
  - Marca/Modelo/Año: en tabla de datos del vehículo
  - Girador (Técnico): firma del documento, busca "TÉCNICO SINIESTROS" o similar al pie
Formato 2 (Detalle de aprobación):
  - N° Orden: campo "NRO DE OC"
  - N° Siniestro: campo "SINIESTRO"
  - Póliza: campo "PÓLIZA"
  - Placa: campo "PLACA"
  - Marca/Modelo/Año: en la misma línea que PLACA
  - Girador (Técnico): campo "TÉCNICO" al pie del documento

MAPFRE (Orden de Trabajo):
  - N° Orden: el número grande después de "ORDEN DE TRABAJO" (ej: 202602030602)
  - N° Siniestro: campo "SINIESTRO:" en datos del siniestro
  - Expediente: campo "EXPEDIENTE:" (ej: 1-PPD)
  - Póliza: campo "POLIZA:"
  - Placa: campo "PLACA:" en datos del vehículo
  - Marca/Modelo/Año: en tabla datos del vehículo
  - VIN: campo "CHASIS:"
  - Girador (Perito): campo "Perito:" al pie del documento
  - Piezas: en tabla "DESCRIPCIÓN Y EVALUACIÓN DE DAÑOS", filas con prefijo REP

PACIFICO:
  - N° Orden: campo "Folio:" (ej: 20260413-1737000_01)
  - N° Siniestro: campo "Siniestro:"
  - Póliza: campo "Poliza:"
  - VIN: campo "VIN:"
  - Placa: campo "Placa:"
  - Marca/Fabricante: campo "Fabricante:"
  - Modelo: campo "Modelo:"
  - Año: campo "Año Vehículo:"
  - Girador (Nombre Usuario): campo "Nombre Usuario:"
  - Piezas: en tabla con columnas DESCRIPCION/REFERENCIA/IMPORTE, busca filas numeradas (1., 2.) en columna DESCRIPCION, IGNORAR columnas REFERENCIA e IMPORTE

LA_POSITIVA (Orden de Compra):
  - N° Orden: campo "N° OC-" al inicio
  - N° Siniestro: campo "Siniestro:"
  - Póliza: campo "Póliza:"
  - Placa: campo "Placa:"
  - Marca/Modelo/Año: en la misma línea que Placa
  - VIN: campo "N° Serie:"
  - Girador (Técnico): campo "Técnico de Vehículos:" al pie, o la firma
  - Piezas: en tabla "Cambio/Reparacion por" + "Descripción", busca la descripción del servicio

INTERSEGURO:
  - Girador: siempre "José Fernández" sin buscar en el documento

========================
REGLAS PARA PIEZAS
========================
- Cada línea o fila con una pieza = un objeto separado
- "REPARA", "REPARAR", "REP", "REPARACION DE" al inicio = requiere_reparacion true, tipo_trabajo "R"
- "REPARACION Y PINTURA", "RP" = requiere_reparacion true, requiere_pintura true, tipo_trabajo "RP"
- Si dice "PINTURA" o "+ Pintura" en la descripción = requiere_pintura true, tipo_trabajo "RP"
- LH = lado Izquierdo, RH = lado Derecho, DELT = Frontal, POST = Posterior
- FARO, NEBLINERO = es_faro true, requiere_pulido true si también tiene pintura
- IGNORAR filas vacías, subtotales, IGV, totales, deducibles

========================
REGLAS GENERALES
========================
- La PLACA es crítica — búscala aunque esté en campos con nombres diferentes (Rodaje, Placa, etc.)
- Si un campo tiene nombre diferente pero claramente contiene el dato, úsalo
- No inventes datos — si no lo ves claramente, usa null

Devuelve SOLO este JSON sin markdown:
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
}`er'
import Anthropic from '@anthropic-ai/sdk'

// ================================================
// CONFIGURACIÓN: elige qué proveedor usar
// ================================================
const USE_GOOGLE_VISION = true
const USE_CLAUDE = false
const USE_OPENAI = false
// ================================================

const PROMPT = `Eres un experto en leer órdenes de trabajo de talleres automotrices peruanos.
Analiza esta imagen de una orden de trabajo y extrae los datos del vehículo y las piezas a reparar.

FORMATOS DE ORDEN QUE PUEDES ENCONTRAR:

FORMATO MAPFRE / RIMAC:
- Tabla con columna PIEZA o DESCRIPCION Y EVALUACION DE DAÑOS
- Las piezas tienen prefijo D (desmontar) o REP (reparar)
- Ejemplo: "REP MOLDURA MALETERA", "REP FUNDA DEL", "REP REJILLA DEL"
- Cada línea REP es una pieza separada

FORMATO PACIFICO / HDI:
- Tabla con columnas: DESCRIPCION | REFERENCIA | IMPORTE | % DTO PIR | TOTAL
- Las piezas están en la columna DESCRIPCION con número al inicio: "1. REP FUNDA POST", "2. REP FUNDA POST INF"
- IGNORAR completamente las columnas REFERENCIA, IMPORTE, TOTAL
- IGNORAR líneas como "Subtotal", "IGV", "Total", "T. Cambio"
- Cada fila numerada en DESCRIPCION es una pieza

REGLAS GENERALES:
- REP o R = solo reparación, tipo_trabajo="R", requiere_pintura=false
- RP = reparación + pintura, tipo_trabajo="RP", requiere_pintura=true
- Si el nombre termina en COLOR = requiere_pintura=true, tipo_trabajo="RP"
- Si el nombre termina en NEGRO PP = requiere_pintura=false, tipo_trabajo="R"
- RH = lado Derecho, LH = lado Izquierdo, DELT = Frontal, POST = Posterior
- FARO en el nombre = es_faro=true
- POST INF = Posterior Inferior (es una sola pieza)

Devuelve UNICAMENTE JSON valido sin markdown:
{
  "numero_siniestro": "string o null",
  "numero_orden": "string o null",
  "expediente": "string o null",
  "poliza": "string o null",
  "placa": "string o null",
  "marca": "string o null",
  "modelo": "string o null",
  "anio": null,
  "color": "string o null",
  "vin": "string o null",
  "nombre_asegurado": "string o null",
  "telefono_asegurado": "string o null",
  "tipo_seguro": "RIMAC|PACIFICO|MAPFRE|LA_POSITIVA|HDI|INTERSEGURO|TALLER|OTRO",
  "nombre_girador": "string o null",
  "taller_origen": "string o null",
  "fecha_recojo": "YYYY-MM-DD o null",
  "observaciones": "string o null",
  "piezas": [
    {
      "nombre": "nombre descriptivo en español sin abreviaturas",
      "lado": "Izquierdo|Derecho|Frontal|Posterior|N/A",
      "color": "color o null",
      "requiere_reparacion": true,
      "requiere_pintura": false,
      "es_faro": false,
      "tipo_trabajo": "R|RP",
      "precio": null
    }
  ]
}`

// Normaliza la respuesta del nuevo formato al formato que espera el formulario
function normalizar(raw: any) {
  const seg = raw.seguro || {}
  const veh = raw.vehiculo || {}

  // Normalizar compañía de seguro
  const segMap: Record<string, string> = {
    'RIMAC': 'RIMAC', 'PACIFICO': 'PACIFICO', 'MAPFRE': 'MAPFRE',
    'POSITIVA': 'LA_POSITIVA', 'LA_POSITIVA': 'LA_POSITIVA',
    'HDI': 'HDI', 'INTERSEGURO': 'INTERSEGURO', 'TALLER': 'TALLER'
  }
  let tipoSeguro = 'OTRO'
  if (seg.compania) {
    const comp = seg.compania.toUpperCase()
    for (const [k, v] of Object.entries(segMap)) {
      if (comp.includes(k)) { tipoSeguro = v; break }
    }
  }

  return {
    numero_siniestro: seg.siniestro || null,
    numero_orden: seg.orden || null,
    expediente: null,
    poliza: seg.poliza || null,
    placa: veh.placa || null,
    marca: veh.marca || null,
    modelo: veh.modelo || null,
    anio: veh.anio || null,
    color: veh.color || null,
    vin: veh.vin || null,
    nombre_asegurado: null,
    telefono_asegurado: null,
    tipo_seguro: tipoSeguro,
    nombre_girador: seg.girador || null,
    taller_origen: null,
    fecha_recojo: null,
    observaciones: null,
    piezas: (raw.piezas || []).map((p: any) => ({
      nombre: p.nombre || '',
      lado: p.lado || 'N/A',
      color: p.color || null,
      requiere_reparacion: true,
      requiere_pintura: p.requiere_pintura === true,
      es_faro: p.requiere_pulido === true,
      requiere_pulido: p.requiere_pulido === true,
      tipo_trabajo: p.requiere_pintura ? 'RP' : 'R',
      precio: null,
    }))
  }
}

async function procesarConOpenAI(base64: string, mediaType: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
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
    messages: [{ role: 'user', content: `${PROMPT}\n\nTexto extraído:\n\n${textoExtraido}` }]
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
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

    if (USE_OPENAI) {
      jsonText = await procesarConOpenAI(base64, mediaType)
      proveedor = 'openai'
    } else if (USE_GOOGLE_VISION) {
      jsonText = await procesarConGoogleVision(base64)
      proveedor = 'google'
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
