import { NextRequest, NextResponse } from 'next/server'

const PROMPT = `Lee esta orden de trabajo automotriz peruana.

Primero identifica visualmente todos los datos que puedas ver.
Luego devuelve SOLO JSON válido.

Campos obligatorios:
numero_siniestro
numero_orden
marca
placa
tipo_seguro
nombre_girador
taller_origen
color
piezas

Reglas:
- tipo_seguro: RIMAC, MAPFRE, PACIFICO, LA_POSITIVA, INTERSEGURO, HDI, TALLER u OTRO.
- nombre_girador: buscar cerca de Técnico, Perito, Asesor, Ajustador, Inspector, Responsable, Autorizado, VoBo, Realizado por, Nombre Usuario o firma.
- taller_origen: buscar en TALLER PRINCIPAL, ATENCIÓN A TALLER, Cliente, Sede, a los señores, Dirección Taller, Razón Social Proveedor.
- No usar REIBPLAST como taller_origen si es receptor.
- piezas: extraer cada pieza o servicio por separado.
- REP, REPARA, REPARAR, REPARACIÓN = reparación.
- PINTURA, PINTAR, RP = pintura.
- FARO, NEBLINERO, LUZ = es_faro.
- PULIDO = requiere_pulido.
- LH/IZQ = Izquierdo; RH/DER = Derecho; DEL/DELT = Frontal; POST = Posterior.
- Si es faro y no dice cambio/reemplazo/sustitución, requiere_pulido=true.
- Si no sabes un dato, usa null.

JSON:
{
  "numero_siniestro": null,
  "numero_orden": null,
  "marca": null,
  "placa": null,
  "tipo_seguro": null,
  "nombre_girador": null,
  "taller_origen": null,
  "color": null,
  "piezas": [
    {
      "nombre": "",
      "lado": "N/A",
      "requiere_reparacion": false,
      "requiere_pintura": false,
      "es_faro": false,
      "requiere_pulido": false,
      "tipo_trabajo": null
    }
  ]
}`

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

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${file.type};base64,${base64}`
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

    if (data.error) {
      throw new Error(data.error.message)
    }

    let jsonText = data.choices?.[0]?.message?.content || ''

    // limpiar
    jsonText = jsonText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    let parsed

    try {
      parsed = JSON.parse(jsonText)
    } catch {
      console.error("JSON inválido:", jsonText)
      return NextResponse.json({
        success: false,
        raw: jsonText
      })
    }

    return NextResponse.json({
      success: true,
      data: parsed
    })

  } catch (error: any) {
    console.error(error)

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
 
 
