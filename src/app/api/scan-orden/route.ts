````ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

// ================================================
// PROMPT (ANTIGUO OPTIMIZADO PARA OCR)
// ================================================
const PROMPT = `Eres un experto en leer órdenes de trabajo de talleres automotrices peruanos.
El texto puede venir desordenado por OCR. Interprétalo aunque esté mal alineado.

Responde SOLO JSON válido.

SEGURO:
RIMAC, MAPFRE, LA_POSITIVA, PACIFICO, INTERSEGURO, HDI, TALLER.

CAMPOS:
numero_orden (N°, ORDEN, NumOS)
numero_siniestro (Siniestro, Caso)
placa (Placa, Rodaje)
poliza (Póliza)
expediente (Expediente)

GIRADOR:
Técnico, Perito, Asesor, Ajustador, Inspector, Responsable, Autorizado, VoBo
INTERSEGURO = "José Fernández"

TALLER:
Atención a Taller, Cliente, Sede, Proveedor

PIEZAS:
REP o REPARA → reparacion
PINTURA o RP → pintura
ambos → "RP", si no → "R"

LADOS:
LH=Izquierdo, RH=Derecho, DELT=Frontal, POST=Posterior

Ignorar totales e IGV.
Si dudas → null.

JSON:
{
"numero_siniestro":null,
"numero_orden":null,
"expediente":null,
"poliza":null,
"placa":null,
"marca":null,
"modelo":null,
"anio":null,
"color":null,
"vin":null,
"nombre_asegurado":null,
"telefono_asegurado":null,
"tipo_seguro":"TALLER",
"nombre_girador":null,
"taller_origen":null,
"fecha_recojo":null,
"observaciones":null,
"piezas":[{"nombre":"","lado":"N/A","color":null,"requiere_reparacion":true,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":"R","precio":null}]
}`

// ================================================
// OCR GOOGLE (SIN RECORTE)
// ================================================
async function extraerTextoGoogleVision(base64: string) {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) throw new Error('Falta GOOGLE_VISION_API_KEY')

  const res = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
        }]
      })
    }
  )

  const data = await res.json()

  const texto = data.responses?.[0]?.fullTextAnnotation?.text || ''
  if (!texto) throw new Error('OCR vacío')

  console.log("OCR TEXTO:", texto) // 🔥 DEBUG

  return texto // 🔥 SIN RECORTE
}

// ================================================
// OPENAI TEXTO
// ================================================
async function interpretarConOpenAI(texto: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `${PROMPT}\n\nOCR:\n${texto}`
        }
      ]
    })
  })

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return data.choices?.[0]?.message?.content || ''
}

// ================================================
// OPENAI VISIÓN (FALLBACK)
// ================================================
async function procesarConOpenAIVision(base64: string, mediaType: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64}`,
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

  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  return data.choices?.[0]?.message?.content || ''
}

// ================================================
// JSON SEGURO
// ================================================
function parseSeguro(text: string) {
  try {
    return JSON.parse(
      text.replace(/```json/g, '').replace(/```/g, '').trim()
    )
  } catch {
    console.error("JSON inválido:", text)
    throw new Error("IA no devolvió JSON válido")
  }
}

// ================================================
// API
// ================================================
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('imagen') as File

    if (!file) {
      return NextResponse.json({ error: 'No hay imagen' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    let data

    // 1️⃣ OCR + IA
    const textoOCR = await extraerTextoGoogleVision(base64)
    let jsonText = await interpretarConOpenAI(textoOCR)

    try {
      data = parseSeguro(jsonText)
    } catch {
      data = {}
    }

    // 2️⃣ FALLBACK si falla
    if (!data.numero_orden && !data.placa) {
      console.log("⚠️ Fallback a visión directa")

      jsonText = await procesarConOpenAIVision(base64, file.type)
      data = parseSeguro(jsonText)
    }

    // ============================================
    // 💰 COBRO
    // ============================================
    try {
      const supabase = createSupabase(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const COSTO = 0.5

      const { data: cred } = await supabase
        .from('creditos_ocr')
        .select('id, saldo')
        .limit(1)
        .single()

      if (cred && Number(cred.saldo) < COSTO) {
        return NextResponse.json(
          { error: 'Saldo insuficiente' },
          { status: 402 }
        )
      }

      if (cred) {
        await supabase
          .from('creditos_ocr')
          .update({
            saldo: Number(cred.saldo) - COSTO
          })
          .eq('id', cred.id)
      }

      await supabase.from('uso_ocr').insert({
        costo: COSTO,
        piezas_extraidas: data.piezas?.length || 0,
        numero_siniestro: data.numero_siniestro || null,
        exitoso: true
      })

    } catch (e) {
      console.error('Error créditos:', e)
    }

    return NextResponse.json({ success: true, data })

  } catch (error: any) {
    console.error(error)

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
````
