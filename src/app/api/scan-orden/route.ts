import { NextRequest, NextResponse } from 'next/server'

// ================================================
// PROMPT DE PRUEBA (SIN JSON)
// ================================================
const PROMPT = `Describe todo lo que ves en esta orden de trabajo automotriz.
Incluye números, placa, nombres, piezas, todo lo que puedas leer.`

// ================================================
// OPENAI VISIÓN DIRECTA
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

if (data.error) {
throw new Error(data.error.message)
}

return data.choices?.[0]?.message?.content || ''
}

// ================================================
// API
// ================================================
export async function POST(request: NextRequest) {
try {
const formData = await request.formData()
const file = formData.get('imagen') as File

```
if (!file) {
  return NextResponse.json({ error: 'No hay imagen' }, { status: 400 })
}

console.log("TIPO:", file.type)
console.log("SIZE:", file.size)

const bytes = await file.arrayBuffer()
const base64 = Buffer.from(bytes).toString('base64')

const respuesta = await procesarConOpenAIVision(base64, file.type)

console.log("RESPUESTA IA:", respuesta)

return NextResponse.json({
  debug: true,
  respuesta
})
```

} catch (error: any) {
console.error(error)

```
return NextResponse.json(
  { error: error.message },
  { status: 500 }
)
```

}
} 
