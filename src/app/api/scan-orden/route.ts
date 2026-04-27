import { NextRequest, NextResponse } from 'next/server'

const PROMPT = `
Lee visualmente esta orden de trabajo automotriz peruana y extrae datos reales.

Campos obligatorios:
- numero_siniestro
- numero_orden
- marca
- placa
- tipo_seguro
- nombre_girador
- taller_origen
- color
- piezas

Reglas:
tipo_seguro: RIMAC, MAPFRE, PACIFICO, LA_POSITIVA, INTERSEGURO, HDI, TALLER u OTRO.

nombre_girador:
buscar cerca de Técnico, Perito, Asesor, Ajustador, Inspector, Responsable, Autorizado, VoBo, Realizado por, Nombre Usuario o firma.

taller_origen:
buscar en TALLER PRINCIPAL, ATENCIÓN A TALLER, Cliente, Sede, a los señores, Dirección Taller, Razón Social Proveedor.
No uses REIBPLAST como taller_origen si es receptor.

piezas:
extrae cada pieza por separado.
REP, REPARA, REPARAR, REPARACIÓN = reparación.
PINTURA, PINTAR, RP = pintura.
FARO, NEBLINERO, LUZ = es_faro.
PULIDO = requiere_pulido.
LH/IZQ = Izquierdo.
RH/DER = Derecho.
DEL/DELT = Frontal.
POST = Posterior.
`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('imagen') as File

    if (!file) {
      return NextResponse.json({ error: 'No hay imagen' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mediaType = file.type || 'image/jpeg'

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 1200,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'orden_taller',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                numero_siniestro: { type: ['string', 'null'] },
                numero_orden: { type: ['string', 'null'] },
                marca: { type: ['string', 'null'] },
                placa: { type: ['string', 'null'] },
                tipo_seguro: { type: ['string', 'null'] },
                nombre_girador: { type: ['string', 'null'] },
                taller_origen: { type: ['string', 'null'] },
                color: { type: ['string', 'null'] },
                piezas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      nombre: { type: ['string', 'null'] },
                      lado: { type: ['string', 'null'] },
                      requiere_reparacion: { type: 'boolean' },
                      requiere_pintura: { type: 'boolean' },
                      es_faro: { type: 'boolean' },
                      requiere_pulido: { type: 'boolean' },
                      tipo_trabajo: { type: ['string', 'null'] },
                    },
                    required: [
                      'nombre',
                      'lado',
                      'requiere_reparacion',
                      'requiere_pintura',
                      'es_faro',
                      'requiere_pulido',
                      'tipo_trabajo',
                    ],
                  },
                },
              },
              required: [
                'numero_siniestro',
                'numero_orden',
                'marca',
                'placa',
                'tipo_seguro',
                'nombre_girador',
                'taller_origen',
                'color',
                'piezas',
              ],
            },
          },
        },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mediaType};base64,${base64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
    })

    const result = await res.json()

    if (result.error) {
      throw new Error(result.error.message)
    }

    const content = result.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('OpenAI no devolvió contenido')
    }

    const parsed = JSON.parse(content)

    return NextResponse.json({
      success: true,
      data: parsed,
    })
  } catch (error: any) {
    console.error('Error scan-orden:', error)

    return NextResponse.json(
      { error: error.message || 'Error al procesar' },
      { status: 500 }
    )
  }
} 
