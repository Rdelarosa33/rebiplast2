import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

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
const PROHIBIDOS = ['REBIPLAST', 'REIBPLAST', 'RAFAEL GONZALES', 'REBIPLAS']

function estaProhibido(texto: string): boolean {
  if (!texto) return false
  const norm = normalizar(texto)
  return PROHIBIDOS.some(p => norm.includes(p))
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

  for (const cand of cands) {
    if (!cand || estaProhibido(cand)) continue
    const candNorm = normalizar(cand)

    const regs = [...registros].sort((a, b) =>
      (b[campoNombre]?.length || 0) - (a[campoNombre]?.length || 0)
    )

    for (const reg of regs) {
      const nombre = reg[campoNombre] || ''
      const nombreNorm = normalizar(nombre)
      const alias: string[] = (reg.alias || []).map((a: string) => normalizar(a))

      // 1. Exacto nombre oficial
      if (candNorm === nombreNorm) return { nombre, fuente: 'tabla_exacta' }

      // 2. Exacto en alias
      if (alias.some(a => candNorm === a)) return { nombre, fuente: 'tabla_alias' }

      // 3. Parcial nombre oficial
      if (candNorm.includes(nombreNorm) || nombreNorm.includes(candNorm)) {
        return { nombre, fuente: 'tabla_parcial' }
      }

      // 4. Parcial en alias
      if (alias.some(a => candNorm.includes(a) || a.includes(candNorm))) {
        return { nombre, fuente: 'tabla_alias' }
      }

      // 5. Por palabras — más estricto: al menos la mitad de palabras del nombre
      const palabrasNombre = nombreNorm.split(' ').filter(p => p.length > 2)
      const palabrasCand = candNorm.split(' ').filter(p => p.length > 2)
      const matches = palabrasNombre.filter(p => palabrasCand.includes(p))
      if (palabrasNombre.length > 0 && matches.length >= Math.ceil(palabrasNombre.length / 2)) {
        return { nombre, fuente: 'tabla_palabras' }
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

El usuario elegirá manualmente cuál es girador y cuál taller. Tu trabajo
es extraer TODO sin omitir, incluso si crees que algunos no aplican.

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
MONTOS (importante: extraer SIEMPRE)
═══════════════════════════════════════════════════════════════

monto_total: el TOTAL del documento.
- Buscar en: "TOTAL (US$)", "Precio Total S/", "TOTAL", "Monto Total", "Total a Facturar"
- Es el SUBTOTAL si no hay TOTAL con IGV
- Si el documento muestra montos en USD y soles, prioriza USD si está marcado "US$" o "Dólares Americanos"

moneda: "USD" o "PEN" según corresponda.
- Pistas USD: "US$", "Dólares", "Dólares Americanos", "$"
- Pistas PEN: "S/", "Soles", "Nuevos Soles"

monto por pieza: cada pieza puede tener su propio costo.
- Buscar columna "PRECIO TOTAL", "Monto", "PRECIO", "Importe" al lado de cada descripción
- Si una pieza no tiene precio individual claro, dejar monto = null
- Si solo hay un total general (ej: 4 piezas comparten un solo monto $100), 
  poner el total dividido entre las piezas en cada una, O dejar null y 
  poner el total en monto_total únicamente

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
    "entidades": []
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
    const optimized = await sharp(Buffer.from(bytes))
      .rotate()                                       // Auto-rotar según EXIF (corrige fotos verticales)
      .grayscale()                                    // A escala de grises (texto B/N en órdenes)
      .resize({ width: 800, withoutEnlargement: true }) // Resize a 800px (~60% menos tokens vs 1200)
      .jpeg({ quality: 70, mozjpeg: true })           // mozjpeg comprime ~10% más con misma calidad
      .toBuffer()
    return { base64: optimized.toString('base64'), mimeType: 'image/jpeg' }
  } catch {
    // Si sharp no está disponible, usar imagen original
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

    // ── PASO 2: GPT extrae datos y candidatos ──
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
            { type: 'text', text: PROMPT }
          ]
        }]
      })
    })

    const result = await res.json()
    if (result.error) throw new Error(result.error.message)

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

    // ── PASO 8: Inferir seguro desde girador si no se encontró ──
    let tipoSeguroFinal = segMatch.nombre
      ? (refAseg?.find((a: any) => a.variante === segMatch.nombre)?.tipo || data.tipo_seguro)
      : data.tipo_seguro

    if (!tipoSeguroFinal && girMatch.nombre) {
      const girReg = refGir?.find((g: any) => g.nombre === girMatch.nombre)
      if (girReg?.aseguradora && girReg.aseguradora !== 'TALLER') {
        tipoSeguroFinal = girReg.aseguradora
        debugLog.push({ campo: 'seguro_inferido', desde: 'girador', valor: tipoSeguroFinal })
      }
    }

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
    // Taller: priorizar match en tabla, pero si GPT leyó un nombre no prohibido, usarlo como fallback
    let tallerFinal: string | null = tallMatch.nombre || null
    if (!tallerFinal && data.taller_origen && !estaProhibido(data.taller_origen)) {
      tallerFinal = data.taller_origen
    }

    const output: any = {
      numero_siniestro: data.numero_siniestro || null,
      numero_orden: data.numero_orden || null,
      marca: data.marca || null,
      placa: data.placa || null,
      color: data.color || null,
      tipo_seguro: tipoSeguroFinal || null,
      nombre_girador: girMatch.nombre || (!estaProhibido(data.nombre_girador || '') ? data.nombre_girador : null),
      taller_origen: tallerFinal,
      monto_total,
      moneda,
      observaciones,
      piezas: piezasSaneadas,
      candidatos: {
        seguros: candidatos.seguros || [],
        entidades: entidadesUnif,  // Lista única de personas y empresas
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
