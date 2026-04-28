import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'
import { getPromptPorTipo } from './prompts'

// Sharp + GPT-4o-mini requieren Node runtime (no edge)
export const runtime = 'nodejs'
export const maxDuration = 30

// ============================================================
// NORMALIZACIÓN
// ============================================================
function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================================
// BLOQUEO DURO
// ============================================================
const PROHIBIDOS = [
  'REBIPLAST',
  'REIBPLAST',
  'REBIPLAS',
  'RAFAEL GONZALES',
  'RAFAEL GONZALEZ',
  'RAFAELGONZALES',
  'RAFAEL GONZÁLES',
  'RAFAEL GONZÁLEZ',
]

function estaProhibido(texto: string): boolean {
  if (!texto) return false
  const norm = normalizar(texto)
  // Detectar también si contiene "rafael gonzal" (cubre Gonzales, Gonzalez, Gonzáles, etc.)
  if (norm.includes('rafael gonzal')) return true
  if (norm.includes('rebipla')) return true
  return PROHIBIDOS.some(p => norm.includes(normalizar(p)))
}

// ============================================================
// EXTRAER MONTO CON REGEX
// ============================================================
function extraerMonto(texto: string): { monto_total: number | null, moneda: string } {
  if (!texto) return { monto_total: null, moneda: 'USD' }

  const patronesUSD = [
    /TOTAL\s+GENERAL\s*\$\s*([\d,]+\.?\d*)/i,
    /TOTAL\s+A\s+FACTURAR\s*\$\s*([\d,]+\.?\d*)/i,
    /TOTAL\s+MANO\s+DE\s+OBRA\s*\$\s*([\d,]+\.?\d*)/i,
    /SUBTOTAL\s*\$\s*([\d,]+\.?\d*)/i,
    /TOTAL[^S\n]*\$\s*([\d,]+\.?\d*)/i,
  ]
  const patronesPEN = [
    /TOTAL\s+GENERAL\s*S\/\s*([\d,]+\.?\d*)/i,
    /TOTAL\s+A\s+FACTURAR\s*S\/\s*([\d,]+\.?\d*)/i,
    /PRECIO\s+TOTAL\s*S\/\s*([\d,]+\.?\d*)/i,
    /Total\s+S\/\s*([\d,]+\.?\d*)/i,
  ]

  for (const patron of patronesUSD) {
    const m = texto.match(patron)
    if (m) {
      const val = parseFloat(m[1].replace(',', ''))
      if (val > 0) return { monto_total: val, moneda: 'USD' }
    }
  }
  for (const patron of patronesPEN) {
    const m = texto.match(patron)
    if (m) {
      const val = parseFloat(m[1].replace(',', ''))
      if (val > 0) return { monto_total: val, moneda: 'PEN' }
    }
  }
  return { monto_total: null, moneda: 'USD' }
}

// ============================================================
// MATCH INTELIGENTE
// ============================================================
type FuenteMatch = 'tabla_exacta' | 'tabla_alias' | 'tabla_parcial' | 'tabla_palabras' | 'gpt' | null
type MatchResult = { nombre: string; fuente: FuenteMatch }

function matchConLista(candidatos: string[], registros: any[], campoNombre: string): MatchResult {
  if (!candidatos?.length || !registros?.length) return { nombre: '', fuente: null }

  const cands = [...candidatos].sort((a, b) => b.length - a.length)

  // ─── PASADA 1: solo coincidencias EXACTAS en todos los registros ───
  // Esto previene que un match parcial gane sobre uno exacto que existe más adelante en la lista
  for (const cand of cands) {
    if (!cand || estaProhibido(cand)) continue
    const candNorm = normalizar(cand)

    for (const reg of registros) {
      const nombre = reg[campoNombre] || ''
      const nombreNorm = normalizar(nombre)
      const alias: string[] = (reg.alias || []).map((a: string) => normalizar(a))

      // Exacto nombre oficial
      if (candNorm === nombreNorm) return { nombre, fuente: 'tabla_exacta' }

      // Exacto en alias
      if (alias.some(a => candNorm === a)) return { nombre, fuente: 'tabla_alias' }
    }
  }

  // ─── PASADA 2: coincidencias parciales (más laxo) ───
  for (const cand of cands) {
    if (!cand || estaProhibido(cand)) continue
    const candNorm = normalizar(cand)
    const palabrasCand = candNorm.split(' ').filter(p => p.length > 2)

    const regs = [...registros].sort((a, b) =>
      (b[campoNombre]?.length || 0) - (a[campoNombre]?.length || 0)
    )

    for (const reg of regs) {
      const nombre = reg[campoNombre] || ''
      const nombreNorm = normalizar(nombre)
      const alias: string[] = (reg.alias || []).map((a: string) => normalizar(a))

      // Parcial nombre oficial - requiere que UNO contenga al OTRO COMPLETO
      // Ej: "TOYO SERVICE SA" contiene "TOYO SERVICE" ✓ pero "PANA SM TOYO SM" NO contiene "TOYO SERVICE" ✗
      if (candNorm.length >= 4 && nombreNorm.length >= 4) {
        if (candNorm.includes(nombreNorm) || nombreNorm.includes(candNorm)) {
          return { nombre, fuente: 'tabla_parcial' }
        }
      }

      // Parcial en alias
      if (alias.some(a => a.length >= 4 && (candNorm.includes(a) || a.includes(candNorm)))) {
        return { nombre, fuente: 'tabla_alias' }
      }

      // Por palabras - MUY ESTRICTO ahora:
      // Requiere que TODAS las palabras del candidato estén presentes en el registro
      // Y que sean al menos 2 palabras (palabras únicas no califican)
      const palabrasNombre = nombreNorm.split(' ').filter(p => p.length > 2)
      if (palabrasCand.length >= 2 && palabrasNombre.length >= 2) {
        const todasMatch = palabrasCand.every(p => palabrasNombre.includes(p))
        if (todasMatch) {
          return { nombre, fuente: 'tabla_palabras' }
        }
      }
    }
  }

  return { nombre: '', fuente: null }
}

// ============================================================
// PROMPT
// ============================================================
const PROMPT = `Eres un sistema de extracción de datos de órdenes de trabajo automotrices peruanas.
Devuelve SOLO JSON válido siguiendo el esquema al final.

═══════════════════════════════════════════════════════════════
CONCEPTOS CLAVE (entiende qué representa cada cosa)
═══════════════════════════════════════════════════════════════

ASEGURADORA: la compañía de seguros que pagará el trabajo. 
Las más comunes: RIMAC, MAPFRE, PACIFICO, LA_POSITIVA, INTERSEGURO.
Otras posibles: cualquier compañía de seguros peruana.

GIRADOR: la PERSONA o EMPRESA que firma/autoriza la orden de trabajo.
Pistas para identificarlo: aparece junto a firma, sello, o títulos como
"AUTORIZADO", "TÉCNICO", "PERITO", "ASESOR", "RESPONSABLE", "REALIZADO POR",
"AUTORIZADO POR", "JEFE DE SINIESTROS", "TÉCNICO SINIESTROS VEHÍCULOS",
"Técnico de Vehículos", o similar.
Si hay varios candidatos: el girador es quien tiene cargo o firma asociada.
NUNCA es Rebiplast. NUNCA es el asegurado/cliente.

TALLER: lugar físico donde está el carro y a donde se entrega la pieza terminada.
Pistas: aparece como "ATENCIÓN A TALLER", "TALLER PRINCIPAL", "TALLER", 
"ENTREGAR A", "Sirvase entregar...a los señores ___", "Cliente Taller",
o como header de la empresa cuando esa empresa NO es una aseguradora.
NUNCA es Rebiplast (Rebiplast es el proveedor que recibe la pieza).

ASEGURADO: cliente final dueño del carro. Aparece en "Asegurado:", 
"Cliente:", "Afectado:", "Sr.:". Campo opcional.

PROVEEDOR: siempre es REBIPLAST. Aparece en "PROVEEDOR:", "Razón Social Proveedor".
NUNCA usar Rebiplast como girador ni taller.

═══════════════════════════════════════════════════════════════
REGLA DE HEADER (importante)
═══════════════════════════════════════════════════════════════

El HEADER (logo arriba del documento) puede ser:
A) Una ASEGURADORA conocida → tipo_seguro = esa aseguradora
   Ejemplos: RIMAC, MAPFRE, La Positiva, Pacífico, Interseguro

B) Un TALLER que emite la orden → taller_origen = ese header
   En este caso la aseguradora real está dentro del documento en campos como:
   "Cia Seguro:", "Facturar a:", "Compañía:", "Aseguradora:"
   Ejemplos vistos: "EA Corp SAC", "Qualität - Asesoría y Servicios"

Si dudas: una aseguradora es identificable por su logo conocido y por estar 
asociada al sector seguros. Una empresa con RUC y dirección que no encaja 
con ninguna aseguradora conocida → es taller.

═══════════════════════════════════════════════════════════════
EXTRACCIÓN DE CAMPOS
═══════════════════════════════════════════════════════════════

numero_siniestro: número que identifica el siniestro. Buscar en "Siniestro:", 
"Siniestro N°", "DATOS DEL SINIESTRO". Puede tener formato variado:
1013189, 100130126001462, 69-009554, 231151897, etc.
Solo el número, NO descripciones como "Colision X Cta del Seguro".

numero_orden: número de orden de trabajo. Buscar en "NRO DE OC", "OC-", "OTR", 
"Orden de Trabajo No.", "Folio:", "ORDEN DE TRABAJO Nro.". 
NO confundir con NumOS (eso es otro campo).

placa: formato peruano. Letras + 3 números (ABC123) o 4 números (ABC1234).
Puede tener guión: BYQ-727. Buscar en "Placa:".

marca, modelo, color, anio: del vehículo. Buscar en "Marca:", "Modelo:", 
"DATOS DEL VEHÍCULO".

datos_extra: expediente, poliza, vin, nombre_asegurado, telefono_asegurado, 
observaciones_orden.

═══════════════════════════════════════════════════════════════
CANDIDATOS (lista TODO lo que veas, sin filtrar)
═══════════════════════════════════════════════════════════════

candidatos.seguros: nombres de aseguradoras que aparezcan visibles

candidatos.entidades: lista UNIFICADA de TODOS los nombres de personas Y empresas
que aparezcan en el documento, EXCEPTO Rebiplast.
Incluir SIEMPRE:
- Nombres de personas (asegurados, peritos, técnicos, asesores, autorizados, firmantes)
- Nombres de empresas (talleres, gestoras, agencias, contactos)
- Nombres compuestos completos (ej: "Pedro Agrado Munives", "Alpiconsult S.A.C.")
NO incluir:
- Rebiplast / Rebiplast EIRL
- Aseguradoras conocidas (esas van en candidatos.seguros)

candidatos.numeros_documento: lista de TODOS los números identificadores
visibles en el documento (siniestro, orden, caso, póliza, expediente, folio, etc).
NO incluir RUCs (los RUCs son fáciles de identificar por tener 11 dígitos
y empezar con 10/15/17/20, esos los ignoras).
SÍ incluir:
- "1013189" (siniestro)
- "0000129446" (OC)
- "4217272" (caso)
- "533674" (póliza)
- "OTR20262294" (orden)
- "69-009554" (con guión)
- Cualquier otro número que parezca identificador

Ejemplo de candidatos.numeros_documento para una orden RIMAC:
["0000129446", "4217272", "1013189", "533674"]

El usuario elegirá manualmente cuál es siniestro y cuál es orden.

Ejemplo de candidatos.entidades para una orden RIMAC:
["Toyo Service", "SAN MIGUEL", "Pedro Agrado Munives", "Gianfranco Alberto Lopez Burga"]

Esto sirve para que la app pueda mostrar opciones al usuario.

═══════════════════════════════════════════════════════════════
EXTRACCIÓN DE PIEZAS
═══════════════════════════════════════════════════════════════

Cada pieza se identifica por una descripción de trabajo + ubicación.
Cada renglón de descripción = UNA pieza separada (no agrupar).

DÓNDE BUSCAR (varía por documento):
- Tabla principal con columnas "DESCRIPCIÓN", "OPERACIÓN", "PIEZA", 
  "Cambio/Reparación", "DETALLE DE APROBACIÓN"
- Sección "Observaciones:" si hay piezas listadas allí
- Líneas con códigos como "REP", "RP", "5A 2273T"

CASOS ESPECIALES:
- Si una celda contiene varias líneas con "REP xxx" cada una, son piezas SEPARADAS
- Si el documento es Qualität u otra gestora, las piezas suelen estar SOLO 
  en "Observaciones" (ej: "OT POR REPUESTO: FUNDA POST SUP"). 
  IGNORAR la tabla de montos genéricos (Planchado, Pintura, Terceros, etc.)

REGLAS PARA FLAGS:
- "REP", "REPARAR", "REPARACIÓN" → requiere_reparacion = true
- "PINTURA", "PINT", "+ Pintura" → requiere_pintura = true
- "PULIDO" → requiere_pulido = true
- "FARO", "NEBLINERO" → es_faro = true
- "REP+PINTURA", "RP", "Reparación + Pintura" → ambas (reparación + pintura)

═══════════════════════════════════════════════════════════════
DESCRIPCIONES EN VARIAS LÍNEAS (importante)
═══════════════════════════════════════════════════════════════

Si la descripción de UNA pieza está dividida en MÚLTIPLES LÍNEAS dentro
de la misma celda de tabla (con saltos de línea), UNÍFICALAS en una sola
pieza con nombre completo. NO las trates como piezas separadas.

Ejemplos de descripciones multilínea que son UNA SOLA pieza:
- "REPARAR\nPARACHOQUE\nPOSTERIOR"  → 1 pieza: "REPARAR PARACHOQUE POSTERIOR"
- "REPARACION DE\nFUNDA POSTERIOR"  → 1 pieza: "REPARACION DE FUNDA POSTERIOR"
- "REPARACION Y\nPINTURA DE SPOILER\nDE FUNDA POSTERIOR" → 1 pieza
- "REP MOLDURA\nMALETERA"  → 1 pieza: "REP MOLDURA MALETERA"

Cómo distinguir si son piezas separadas o una sola:
- MISMA CELDA con saltos de línea = 1 pieza, unir
- DIFERENTES CELDAS / FILAS de tabla = piezas distintas
- MISMA CELDA con códigos de pieza distintos al inicio (ej: "REP A...\nREP B...") = piezas distintas

Si el texto está desvaído, parcialmente tachado o difícil de leer, intenta
leer todas las palabras visibles aunque algunas estén borrosas. Es mejor
incluir el nombre completo aunque tenga que adivinar 1-2 letras.

═══════════════════════════════════════════════════════════════
MONTOS (CRÍTICO: extraer SIEMPRE - no dejar null si hay un número)
═══════════════════════════════════════════════════════════════

monto_total: el TOTAL del documento. ESTE CAMPO ES CRÍTICO, NO LO DEJES NULL.
Pasos para encontrarlo:

1. PRIMERO buscar la palabra "TOTAL" en el documento (puede aparecer como):
   - "TOTAL (US$)"
   - "TOTAL (S/)"
   - "TOTAL"
   - "Total"
   - "Precio Total"
   - "TOTAL A FACTURAR"
   - "Monto Aprobado"
   El número que está al lado/debajo de "TOTAL" es el monto_total.

2. SI NO HAY "TOTAL" explícito, usar "SUBTOTAL":
   - "SUBTOTAL (US$)"
   - "SUB TOTAL"
   - "Sub Total"

3. SI NO HAY ninguno, sumar los precios de todas las piezas individuales.

EJEMPLOS REALES:
- Documento RIMAC con "SUBTOTAL (US$): 30.00 / IGV (US$): 5.40 / TOTAL (US$): 35.40"
  → monto_total = 35.40
- Documento Pacífico con "Precio Total S/: 80.00"
  → monto_total = 80.00
- Documento La Positiva con tabla de precios sin total → suma de precios

NO RETORNES null SI EL DOCUMENTO TIENE NÚMEROS QUE PARECEN MONTOS.
Lee la imagen completa - los montos suelen estar en una tabla al final 
o al lado derecho de cada pieza. NO te saltes este campo.

moneda: "USD" o "PEN" según corresponda.
- Pistas USD: "US$", "Dólares", "Dólares Americanos", "$"
- Pistas PEN: "S/", "Soles", "Nuevos Soles"
- Si no hay pista clara, usar "USD"

monto por pieza: cada pieza puede tener su propio costo.
- Buscar columna "PRECIO TOTAL", "Monto", "PRECIO", "Importe", "PRECIO UNIT" 
  al lado de cada descripción
- Si una pieza no tiene precio individual claro, dejar monto = null
- Si solo hay un total general (ej: 4 piezas comparten un solo monto $100), 
  dejar monto = null en cada pieza y poner el total en monto_total únicamente

LADOS:
- "LH", "IZQ", "Izquierdo" → lado = "LH"
- "RH", "DER", "Derecho" → lado = "RH"
- "DEL", "DELT", "Delantero", "Frontal" → lado = "DELT"
- "POST", "Posterior", "Trasero" → lado = "POST"
- Sin lado claro → lado = "N/A"

TIPO_TRABAJO (calcular tras los flags):
- Solo Reparación → "R"
- Reparación + Pintura → "RP"
- Reparación + Pintura + Pulido (faro) → "RPP"
- Solo Pulido (faro sin cambio) → "PU"

IGNORAR siempre:
- SUBTOTAL, IGV, TOTAL, Precio, Monto, Tipo de cambio
- Categorías genéricas como columnas: "Planchado", "Pintura", "Mecánica", 
  "Reparación", "Repuestos" cuando son ENCABEZADOS de tabla, no piezas reales

═══════════════════════════════════════════════════════════════
ESTRUCTURA JSON DE RESPUESTA
═══════════════════════════════════════════════════════════════

{
  "numero_siniestro": null,
  "numero_orden": null,
  "marca": null,
  "placa": null,
  "color": null,
  "tipo_seguro": null,
  "nombre_girador": null,
  "taller_origen": null,
  "monto_total": null,
  "moneda": "USD",
  "datos_extra": {
    "expediente": null,
    "poliza": null,
    "modelo": null,
    "anio": null,
    "vin": null,
    "nombre_asegurado": null,
    "telefono_asegurado": null,
    "observaciones_orden": null
  },
  "candidatos": {
    "seguros": [],
    "entidades": [],
    "numeros_documento": []
  },
  "piezas": [
    {
      "nombre": "",
      "lado": "N/A",
      "requiere_reparacion": false,
      "requiere_pintura": false,
      "es_faro": false,
      "requiere_pulido": false,
      "tipo_trabajo": null,
      "monto": null
    }
  ]
}`

function limpiarJSON(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

// Repara JSON truncado cerrando strings, arrays y objects pendientes.
// Útil cuando max_tokens corta la respuesta de GPT a mitad.
function repararJSONTruncado(text: string): string {
  let s = text

  // Eliminar comas finales seguidas de cierre
  s = s.replace(/,\s*([}\]])/g, '$1')

  // Contar comillas no escapadas para saber si quedó string abierto
  let dentroDeString = false
  let escape = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escape) { escape = false; continue }
    if (c === '\\') { escape = true; continue }
    if (c === '"') dentroDeString = !dentroDeString
  }
  if (dentroDeString) s += '"'

  // Cerrar arrays y objetos pendientes contando aperturas vs cierres
  let abrirObj = 0, abrirArr = 0
  let inStr = false; let esc = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (esc) { esc = false; continue }
    if (c === '\\') { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{') abrirObj++
    else if (c === '}') abrirObj--
    else if (c === '[') abrirArr++
    else if (c === ']') abrirArr--
  }

  // Si la última pieza está incompleta, intentar cerrarla limpiamente
  // quitando coma final si la hay
  s = s.replace(/,\s*$/, '')

  while (abrirArr-- > 0) s += ']'
  while (abrirObj-- > 0) s += '}'

  return s
}

function parsearGPT(text: string): any {
  const limpio = limpiarJSON(text)
  try {
    return JSON.parse(limpio)
  } catch (e) {
    // Intentar reparar JSON truncado y volver a parsear
    const reparado = repararJSONTruncado(limpio)
    try {
      return JSON.parse(reparado)
    } catch (e2) {
      console.error('JSON irrecuperable:', limpio.slice(0, 500))
      throw new Error('GPT devolvió JSON inválido (probablemente truncado). Reintenta el escaneo.')
    }
  }
}

// ============================================================
// OPTIMIZAR IMAGEN
// ============================================================
async function optimizarImagen(bytes: ArrayBuffer): Promise<{ base64: string; mimeType: string }> {
  try {
    const sharp = (await import('sharp')).default
    // PIPELINE MÍNIMO - sin alterar la imagen
    // - rotate(): corrige orientación si la foto fue tomada en vertical (EXIF)
    // - resize: solo si es muy grande, para no gastar tokens innecesarios
    // - JPEG calidad 90: alta calidad, sin artefactos de compresión
    // NO se aplica: grayscale, normalize, linear, sharpen (la IA recibe la imagen tal cual)
    const optimized = await sharp(Buffer.from(bytes))
      .rotate()                                          // Auto-rotar según EXIF
      .resize({ width: 1600, withoutEnlargement: true }) // Resize solo si es mayor a 1600px
      .jpeg({ quality: 90, mozjpeg: true })              // Calidad alta, sin pérdida visible
      .toBuffer()
    return { base64: optimized.toString('base64'), mimeType: 'image/jpeg' }
  } catch {
    // Si sharp no está disponible, usar imagen original sin modificaciones
    return { base64: Buffer.from(bytes).toString('base64'), mimeType: 'image/jpeg' }
  }
}

// ============================================================
// MAIN
// ============================================================
export async function POST(request: NextRequest) {
  const debugLog: any[] = []

  try {
    const formData = await request.formData()
    const file = formData.get('imagen') as File
    if (!file) return NextResponse.json({ error: 'No se recibio imagen' }, { status: 400 })

    // Recibir el tipo de seguro seleccionado por el usuario
    const tipoSeleccionado = (formData.get('tipo_seleccionado') as string || 'TALLER') as
      'RIMAC' | 'MAPFRE' | 'PACIFICO' | 'LA_POSITIVA' | 'INTERSEGURO' | 'TALLER'
    debugLog.push({ campo: 'tipo_seleccionado', valor: tipoSeleccionado })

    const bytes = await file.arrayBuffer()
    const { base64, mimeType } = await optimizarImagen(bytes)

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── PASO 1: Verificar/recargar saldo antes de procesar ──
    const { data: cred } = await supabase.from('creditos_ocr').select('id, saldo').single()
    // Si el saldo es menor a $5, recargar automáticamente $50 (deuda registrada)
    if (cred && cred.saldo <= 5) {
      const RECARGA_AUTO = 50
      const saldoAnterior = cred.saldo
      const saldoNuevo = saldoAnterior + RECARGA_AUTO
      await supabase.from('creditos_ocr')
        .update({ saldo: saldoNuevo, updated_at: new Date().toISOString() })
        .eq('id', cred.id)
      // Registrar la recarga (pagada=false para llevar la deuda)
      await supabase.from('recargas_ocr').insert({
        monto: RECARGA_AUTO,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo,
        nota: 'Recarga automática',
        automatica: true,
        pagada: false,
      })
      // Actualizar saldo en memoria para el resto de la lógica
      cred.saldo = saldoNuevo
    }
    // Bloqueo solo si por algún motivo extremo no hay saldo
    if (cred && cred.saldo < 0.30) {
      return NextResponse.json({ error: 'Saldo OCR insuficiente.' }, { status: 402 })
    }

    // Obtener prompt específico para el tipo seleccionado
    const promptEspecifico = getPromptPorTipo(tipoSeleccionado)

    // ── PASO 2: GPT extrae datos y candidatos ──
    // Estructura optimizada para prompt caching:
    // - system: prompt fijo (OpenAI lo cachea automáticamente al 50% en llamadas siguientes en ~5min)
    // - user: solo la imagen (parte variable, no se cachea)
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: promptEspecifico,  // Prompt específico del tipo elegido - se cachea
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
              { type: 'text', text: 'Procesa esta orden siguiendo las instrucciones del system prompt.' },
            ],
          },
        ],
      }),
    })

    const result = await res.json()
    if (result.error) throw new Error(result.error.message)

    // Log de uso de tokens y cache (para verificar si el prompt caching está funcionando)
    if (result.usage) {
      const cached = result.usage.prompt_tokens_details?.cached_tokens || 0
      const total = result.usage.prompt_tokens || 0
      const cachePct = total > 0 ? Math.round((cached / total) * 100) : 0
      debugLog.push({
        campo: 'tokens',
        prompt_tokens: total,
        cached_tokens: cached,
        cache_hit_pct: cachePct,
        completion_tokens: result.usage.completion_tokens || 0,
      })
    }

    const gptRaw = result.choices?.[0]?.message?.content || ''
    const data = parsearGPT(gptRaw)
    const candidatos = data.candidatos || { seguros: [], entidades: [] }

    // ── PASO 3: Monto - priorizar el que GPT devuelve, si no, regex ──
    let monto_total: number | null = null
    let moneda: string = 'USD'
    if (data.monto_total != null) {
      const m = Number(data.monto_total)
      if (!isNaN(m) && m > 0) {
        monto_total = m
        moneda = data.moneda || 'USD'
      }
    }
    if (monto_total === null) {
      // Fallback a regex sobre texto crudo de GPT
      const textoCompleto = JSON.stringify(data)
      const result = extraerMonto(textoCompleto)
      monto_total = result.monto_total
      moneda = result.moneda
    }
    debugLog.push({ campo: 'monto', monto_total, moneda, fuente: data.monto_total != null ? 'gpt' : 'regex' })

    // ── PASO 4: Cargar tablas de referencia ──
    // Selects defensivos: si la columna 'alias' no existe (versión vieja del schema),
    // hacer fallback a select sin alias para no perder los demás campos
    const cargarRef = async (tabla: string, columnasConAlias: string, columnasSinAlias: string): Promise<any[]> => {
      const { data, error } = await supabase.from(tabla).select(columnasConAlias)
      if (error || !data) {
        // Fallback sin alias
        const { data: data2 } = await supabase.from(tabla).select(columnasSinAlias)
        return (data2 as any[]) || []
      }
      return data as any[]
    }

    const [refAseg, refGir, refTall] = await Promise.all([
      cargarRef('ref_aseguradoras', 'variante, tipo, alias', 'variante, tipo'),
      cargarRef('ref_giradores',    'nombre, aseguradora, alias', 'nombre, aseguradora'),
      cargarRef('ref_talleres',     'nombre, alias', 'nombre'),
    ])

    debugLog.push({
      campo: 'tablas_cargadas',
      aseguradoras: refAseg.length,
      giradores: refGir.length,
      talleres: refTall.length,
    })

    // ── PASO 5: Match seguro ──
    const segCandidatos = [...(candidatos.seguros || []), data.tipo_seguro].filter(Boolean)
    const segMatch = matchConLista(segCandidatos, refAseg || [], 'variante')
    debugLog.push({ campo: 'seguro', detectado: data.tipo_seguro, candidatos: candidatos.seguros, match: segMatch.nombre, fuente: segMatch.fuente })

    // Entidades unificadas: GPT ahora devuelve TODOS los nombres de personas y empresas
    // Si vino el formato viejo (giradores/talleres separados), los combinamos
    const entidadesUnif = candidatos.entidades || [
      ...(candidatos.giradores || []),
      ...(candidatos.talleres || []),
    ]

    // ── PASO 6: Match girador (busca en entidades unificadas + lo detectado) ──
    const girCandidatos = [...entidadesUnif, data.nombre_girador].filter(Boolean)
    const girMatch = matchConLista(girCandidatos, refGir || [], 'nombre')
    debugLog.push({ campo: 'girador', detectado: data.nombre_girador, candidatos: entidadesUnif, match: girMatch.nombre, fuente: girMatch.fuente })

    // ── PASO 7: Match taller (busca en entidades unificadas + lo detectado) ──
    const tallCandidatos = [...entidadesUnif, data.taller_origen]
      .filter(Boolean)
      .filter((t: string) => !estaProhibido(t))
    const tallMatch = matchConLista(tallCandidatos, refTall || [], 'nombre')
    debugLog.push({ campo: 'taller', detectado: data.taller_origen, candidatos: entidadesUnif, match: tallMatch.nombre, fuente: tallMatch.fuente })

    // ── PASO 8: tipo_seguro - el usuario MANDA, no se sobrescribe ──
    // El usuario ya eligió el tipo antes de subir la foto.
    // Solo cambiamos si: usuario eligió TALLER y GPT detectó una aseguradora real
    // (en cuyo caso tomamos lo que GPT detectó).
    let tipoSeguroFinal: string = tipoSeleccionado

    if (tipoSeleccionado === 'TALLER') {
      // Usuario no sabía qué era, dejamos que GPT decida
      const detectado = (data.tipo_seguro_detectado || '').toUpperCase().trim()
      if (detectado && detectado !== 'TALLER' &&
          ['RIMAC', 'MAPFRE', 'PACIFICO', 'LA_POSITIVA', 'INTERSEGURO'].includes(detectado)) {
        tipoSeguroFinal = detectado
        debugLog.push({ campo: 'seguro_inferido', desde: 'gpt_detectado', valor: tipoSeguroFinal })
      }
    }
    // Si usuario eligió una aseguradora específica (RIMAC, MAPFRE, etc.) → mantener su elección
    // Esto evita que el sistema "infiera" otra aseguradora desde el girador o BD

    // ── PASO 9: Construir observaciones concatenadas ──
    const extra = data.datos_extra || {}
    const partsObs: string[] = []
    if (extra.expediente) partsObs.push(`Expediente: ${extra.expediente}`)
    if (extra.poliza) partsObs.push(`Póliza: ${extra.poliza}`)
    if (extra.modelo) partsObs.push(`Modelo: ${extra.modelo}`)
    if (extra.anio) partsObs.push(`Año: ${extra.anio}`)
    if (extra.vin) partsObs.push(`VIN: ${extra.vin}`)
    if (extra.nombre_asegurado) partsObs.push(`Asegurado: ${extra.nombre_asegurado}`)
    if (extra.telefono_asegurado) partsObs.push(`Tel: ${extra.telefono_asegurado}`)
    if (extra.observaciones_orden) partsObs.push(`Obs: ${extra.observaciones_orden}`)
    const observaciones = partsObs.length > 0 ? partsObs.join(' | ') : null

    // ── PASO 9.5: Sanear piezas (GPT a veces devuelve strings en lugar de booleanos) ──
    const toBool = (v: any): boolean => {
      if (typeof v === 'boolean') return v
      if (typeof v === 'string') {
        const s = v.toUpperCase().trim()
        return s !== '' && s !== 'FALSE' && s !== 'NO' && s !== 'NULL' && s !== 'N/A'
      }
      return !!v
    }
    const piezasSaneadas = (data.piezas || []).map((p: any) => {
      const requiere_reparacion = toBool(p.requiere_reparacion)
      const requiere_pintura = toBool(p.requiere_pintura)
      const es_faro = toBool(p.es_faro)
      const requiere_pulido = toBool(p.requiere_pulido)
      // Recalcular tipo_trabajo desde flags saneados (consistencia)
      let tipo_trabajo = 'R'
      if (!requiere_reparacion && !requiere_pintura && requiere_pulido) tipo_trabajo = 'PU'
      else if (requiere_reparacion && requiere_pintura && requiere_pulido) tipo_trabajo = 'RPP'
      else if (requiere_reparacion && requiere_pintura) tipo_trabajo = 'RP'
      else if (requiere_reparacion) tipo_trabajo = 'R'
      return {
        nombre: p.nombre || '',
        lado: p.lado || 'N/A',
        requiere_reparacion,
        requiere_pintura,
        es_faro,
        requiere_pulido,
        tipo_trabajo,
        precio: p.precio || null,
        monto: p.monto != null ? Number(p.monto) : null,  // Monto por pieza
        observaciones: p.observaciones || null,
      }
    })

    // ── PASO 10: Construir resultado final ──
    // Estrategia para taller y girador:
    // - Si GPT dejó NULL → respetar (no inventar con BD)
    // - Si GPT detectó algo → usar GPT como principal (no permitir que BD lo pise)
    // - BD solo gana si el match es EXACTO con lo que GPT detectó
    // - Los matches BD parciales se ofrecen como SUGERENCIAS al usuario, no se imponen

    const elegirPrincipal = (matchNombre: string, matchFuente: any, gptValor: string | null): string | null => {
      // Si GPT no detectó nada → null (NO inventar con BD)
      if (!gptValor) return null

      // Si lo detectado es prohibido (Rebiplast/Rafael) → null
      if (estaProhibido(gptValor)) return null

      // Si match es exacto Y coincide con lo de GPT → usar BD (caso ideal de normalización)
      if ((matchFuente === 'tabla_exacta' || matchFuente === 'tabla_alias') &&
          matchNombre && !estaProhibido(matchNombre)) {
        return matchNombre
      }

      // Default: lo que GPT vio en la imagen
      return gptValor
    }

    const tallerFinal = elegirPrincipal(tallMatch.nombre, tallMatch.fuente, data.taller_origen)
    const giradorFinal = elegirPrincipal(girMatch.nombre, girMatch.fuente, data.nombre_girador)

    // Construir lista enriquecida de candidatos:
    // 1) GPT detectó (principal) + 2) Otras entidades vistas + 3) Matches BD relacionados
    const construirCandidatos = (
      principal: string | null,
      entidades: string[],
      matchBD: string | null
    ): string[] => {
      const lista: string[] = []
      const seen = new Set<string>()

      // 1) Principal primero (lo que GPT detectó)
      if (principal && !estaProhibido(principal)) {
        const norm = normalizar(principal)
        if (!seen.has(norm)) {
          lista.push(principal)
          seen.add(norm)
        }
      }

      // 2) Otras entidades vistas en la orden
      for (const e of entidades) {
        if (!e || estaProhibido(e)) continue
        const norm = normalizar(e)
        if (seen.has(norm)) continue
        lista.push(e)
        seen.add(norm)
      }

      // 3) Match BD (si hay y es distinto al principal)
      if (matchBD && !estaProhibido(matchBD)) {
        const norm = normalizar(matchBD)
        if (!seen.has(norm)) {
          lista.push(matchBD)
          seen.add(norm)
        }
      }

      return lista
    }

    // Filtrar entidades para quitar prohibidos
    const entidadesFiltradas = entidadesUnif.filter((e: string) => !estaProhibido(e))

    // LOG SILENCIOSO: detectar si GPT intentó poner Rebiplast/Rafael (violación del prompt)
    const violaciones: string[] = []
    if (estaProhibido(data.nombre_girador || '')) {
      violaciones.push(`girador: ${data.nombre_girador}`)
    }
    if (estaProhibido(data.taller_origen || '')) {
      violaciones.push(`taller: ${data.taller_origen}`)
    }
    for (const ent of (candidatos.entidades || [])) {
      if (estaProhibido(ent)) {
        violaciones.push(`entidad: ${ent}`)
        break  // Solo loguear una vez para no saturar
      }
    }
    if (violaciones.length > 0) {
      debugLog.push({ campo: 'prompt_violacion', detalles: violaciones })
    }

    // Filtrar nombres parciales y completos de un nombre principal
    // (ej: si asegurado es "PAREDES LEON TABATHA", filtra también "LEON", "PAREDES", etc.)
    const filtrarPorNombre = (lista: string[], nombrePrincipal: string): string[] => {
      if (!nombrePrincipal) return lista
      const normPrincipal = normalizar(nombrePrincipal)
      const palabrasPrincipal = normPrincipal.split(' ').filter(p => p.length > 2)  // 3+ chars (antes era 4+)
      return lista.filter((e: string) => {
        const norm = normalizar(e)
        // Match exacto → filtrar
        if (norm === normPrincipal) return false
        // Si la entidad es solo palabras del nombre principal → filtrar
        const palabrasEnt = norm.split(' ').filter(p => p.length > 2)
        if (palabrasEnt.length > 0 && palabrasEnt.every(p => palabrasPrincipal.includes(p))) return false
        return true
      })
    }

    // Para girador: filtrar el asegurado y el taller
    const nombreAsegurado = data.datos_extra?.nombre_asegurado || ''
    let entidadesParaGirador = filtrarPorNombre(entidadesFiltradas, nombreAsegurado)
    if (tallerFinal) {
      entidadesParaGirador = filtrarPorNombre(entidadesParaGirador, tallerFinal)
    }

    // Para taller: filtrar el asegurado y el girador
    let entidadesParaTaller = filtrarPorNombre(entidadesFiltradas, nombreAsegurado)
    if (giradorFinal) {
      entidadesParaTaller = filtrarPorNombre(entidadesParaTaller, giradorFinal)
    }

    // Lista de candidatos para girador y taller (cada uno con su match BD relevante)
    const candidatosGirador = construirCandidatos(giradorFinal, entidadesParaGirador, girMatch.nombre)
    const candidatosTaller = construirCandidatos(tallerFinal, entidadesParaTaller, tallMatch.nombre)

    // Para retrocompatibilidad: lista combinada de entidades (sin duplicados)
    const entidadesCombinadas: string[] = []
    const seenEnt = new Set<string>()
    for (const e of [...candidatosGirador, ...candidatosTaller]) {
      const n = normalizar(e)
      if (!seenEnt.has(n)) {
        entidadesCombinadas.push(e)
        seenEnt.add(n)
      }
    }

    // Detectar mismatch entre tipo seleccionado y tipo detectado por GPT
    let alertaTipoSeguro: string | null = null
    const tipoDetectadoGPT = (data.tipo_seguro_detectado || '').toUpperCase().trim()
    if (
      tipoDetectadoGPT &&
      tipoDetectadoGPT !== tipoSeleccionado &&
      tipoDetectadoGPT !== 'TALLER' &&  // GPT puede decir TALLER si no está seguro
      tipoSeleccionado !== 'TALLER'    // si usuario eligió TALLER, no alertar
    ) {
      alertaTipoSeguro = tipoDetectadoGPT
    }

    const output: any = {
      numero_siniestro: data.numero_siniestro || null,
      numero_orden: data.numero_orden || null,
      marca: data.marca || null,
      placa: data.placa || null,
      color: data.color || null,
      tipo_seguro: tipoSeguroFinal,  // Respeta lo que usuario eligió, salvo TALLER inferido
      tipo_seguro_seleccionado: tipoSeleccionado,
      tipo_seguro_detectado: tipoDetectadoGPT || null,
      alerta_tipo_seguro: alertaTipoSeguro,  // Avisar al frontend si hay mismatch
      nombre_girador: giradorFinal,
      taller_origen: tallerFinal,
      monto_total,
      moneda,
      observaciones,
      piezas: piezasSaneadas,
      candidatos: {
        seguros: candidatos.seguros || [],
        entidades: entidadesCombinadas,  // Lista enriquecida y filtrada (sin Rebiplast/Rafael)
        candidatos_girador: candidatosGirador,  // Específicos para girador (principal + alternativas + match BD)
        candidatos_taller: candidatosTaller,    // Específicos para taller (principal + alternativas + match BD)
        numeros_documento: candidatos.numeros_documento || [],
      },
      confianza: {
        seguro: segMatch.fuente,
        girador: girMatch.fuente,
        taller: tallMatch.fuente || (tallerFinal ? 'gpt' : null),
      }
    }

    // ── PASO 11: Registrar uso y descontar credito ──
    try {
      const COSTO = 0.30
      if (cred) {
        await supabase.from('creditos_ocr')
          .update({ saldo: cred.saldo - COSTO, updated_at: new Date().toISOString() })
          .eq('id', cred.id)
      }
      await supabase.from('uso_ocr').insert({
        seguro_detectado: output.tipo_seguro,
        piezas_extraidas: output.piezas?.length || 0,
        numero_siniestro: output.numero_siniestro,
        costo: COSTO,
        exitoso: true,
        gpt_raw: gptRaw,
        debug_log: debugLog,
      })
    } catch (e) {
      console.error('Error registrando uso OCR:', e)
    }

    return NextResponse.json({
      success: true,
      data: output,
      proveedor: 'gpt-4o-mini+refs',
      debug: debugLog,
      gpt_raw: gptRaw,
    })

  } catch (error: any) {
    console.error('Error scan-orden:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar' }, { status: 500 })
  }
}
