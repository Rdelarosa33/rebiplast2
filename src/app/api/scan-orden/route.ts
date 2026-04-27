import { NextRequest, NextResponse } from 'next/server'

const PROMPT = `Extrae datos de una orden de trabajo automotriz peruana.

Devuelve SOLO JSON válido.

========================
CAMPOS OBLIGATORIOS
========================
numero_siniestro
numero_orden
marca
placa
tipo_seguro
nombre_girador
taller_origen
color
piezas

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
Buscar:
- NRO DE OC
- ORDEN DE TRABAJO
- OC-
- NumOS

========================
SINIESTRO
========================
Buscar:
- Siniestro
- Caso

========================
PLACA / MARCA / COLOR
========================
Buscar directamente en el documento

========================
GIRADOR (PRIORIDAD)
========================
Buscar nombre junto a:

1. Técnico
2. Realizado por
3. Asesor
4. Inspector
5. Jefe de Taller
6. Autorizado
7. VoBo
8. Firma con nombre debajo

Tomar el nombre más claro.

========================
TALLER_ORIGEN (CRÍTICO)
========================

Buscar en este orden de prioridad:

1. "TALLER PRINCIPAL"
2. "ATENCIÓN A TALLER"
3. "Cliente"
4. Texto después de "a los señores"
5. "Dirección Taller"
6. Nombre de empresa en firma inferior
7. "Razón Social Proveedor" (solo si no hay otro)

REGLAS:
- IGNORAR "REIBPLAST" (es receptor)
- Elegir el taller que envía el trabajo
- Si hay persona + empresa → elegir empresa

========================
EXTRACCIÓN DE PIEZAS
========================

Extrae cada pieza por separado desde la sección de trabajos.

Para cada pieza:

- nombre: texto limpio de la pieza
- requiere_reparacion: true si contiene REP, REPARAR, REPARACIÓN
- requiere_pintura: true si menciona pintura o RP
- es_faro: true si contiene FARO, NEBLINERO o LUZ
- requiere_pulido: true si es_faro y NO indica reemplazo

REGLAS:
- Cada línea es una pieza distinta
- No agrupar piezas
- Ignorar subtotales, totales, IGV

========================
REGLAS GENERALES
========================
- No inventar datos
- Si no estás seguro → null

========================
FORMATO JSON
========================

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
      "requiere_reparacion": true,
      "requiere_pintura": false,
      "es_faro": false,
      "requiere_pulido": false
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
 
