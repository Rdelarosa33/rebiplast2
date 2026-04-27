import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

// ================================================
// CONFIG
// ================================================
const USE_GOOGLE_VISION = true
const USE_OPENAI = true
// ================================================

// 🔥 PROMPT OPTIMIZADO (corto)
const PROMPT = `Extrae datos de una orden automotriz peruana desde texto OCR.

Responde SOLO JSON.

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
LH=Izq, RH=Der, DELT=Front, POST=Post

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
// OCR GOOGLE (solo texto)
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

  // 🔥 RECORTE CLAVE (AHORRO $$$)
  return texto.slice(0, 4000)
}

// ================================================
// OPENAI (interpretación barata)
// ================================================
async function interpretarConOpenAI(texto: string) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 800, // 🔥 reducido
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

  const text = data.choices?.[0]?.message?.content || ''

  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
}

// ================================================
// JSON seguro
// ================================================
function parseSeguro(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    console.error('JSON inválido:', text)
    throw new Error('IA no devolvió JSON válido')
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

    // 🔹 OCR
    const textoOCR = await extraerTextoGoogleVision(base64)

    // 🔹 IA
    const jsonText = await interpretarConOpenAI(textoOCR)

    const data = parseSeguro(jsonText)

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

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error(error)

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
