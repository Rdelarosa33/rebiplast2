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
const PROMPT = `Lee esta orden de trabajo automotriz peruana. Devuelve SOLO JSON válido.

PASO 1 - EMISOR (encabezado principal/logo):
Aseguradoras: RIMAC, MAPFRE, PACIFICO, LA_POSITIVA, INTERSEGURO
- Emisor ES aseguradora → tipo_seguro=emisor, taller está DENTRO de la orden
- Emisor NO es aseguradora → taller_origen=emisor, seguro está DENTRO de la orden

PASO 2 - CAMPOS:
numero_siniestro: campo Siniestro/Caso - solo numero, NO descripcion
numero_orden: NRO DE OC/OTR.../OC-/Folio/ORDEN DE TRABAJO Nro. - NO usar NumOS
marca, placa(ABC123/ABC1234), color
nombre_girador: nombre de PERSONA (no direccion/RUC/empresa) junto a Tecnico/Perito/Asesor/Realizado por/VoBo/Jefe de Siniestros/firma
taller_origen: si emisor es aseguradora → TALLER PRINCIPAL/ATENCION A TALLER/Cliente. NUNCA REBIPLAST.
tipo_seguro: RIMAC/MAPFRE/PACIFICO/LA_POSITIVA/INTERSEGURO/TALLER/null
datos_extra: expediente, poliza, modelo, anio, vin, nombre_asegurado, telefono_asegurado, observaciones_orden

CANDIDATOS (todo lo visible aunque no estés seguro):
candidatos.seguros, candidatos.giradores, candidatos.talleres(excepto REBIPLAST)

PASO 3 - PIEZAS (cada linea = UNA pieza, NO agrupar):
MAPFRE: cada "REP xxx" = pieza separada
RIMAC: cada fila descripcion/SERVICIO = pieza
LA_POSITIVA: cada fila Reparacion/Descripcion = pieza
PACIFICO/EA Corp: cada fila OPERACION/DESCRIPCION = pieza
Qualitat/INTERSEGURO: piezas SOLO en Observaciones. Ignorar tabla montos.
Revisar siempre Observaciones para piezas adicionales.

Pieza: nombre, lado(LH=Izquierdo/RH=Derecho/DELT=Frontal/POST=Posterior/N/A), requiere_reparacion(REP), requiere_pintura(PINTURA/RP), es_faro(FARO/NEBLINERO), requiere_pulido(PULIDO/faro sin cambio), tipo_trabajo(R=solo reparación / RP=reparación+pintura / RPP=reparación+pintura+pulido faro / PU=solo pulido)
Ignorar: SUBTOTAL, IGV, TOTAL, Planchado/Pintura/Mecanica como categorias.

{"numero_siniestro":null,"numero_orden":null,"marca":null,"placa":null,"color":null,"tipo_seguro":null,"nombre_girador":null,"taller_origen":null,"datos_extra":{"expediente":null,"poliza":null,"modelo":null,"anio":null,"vin":null,"nombre_asegurado":null,"telefono_asegurado":null,"observaciones_orden":null},"candidatos":{"seguros":[],"giradores":[],"talleres":[]},"piezas":[{"nombre":"","lado":"N/A","requiere_reparacion":false,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":null}]}`

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
    const candidatos = data.candidatos || { seguros: [], giradores: [], talleres: [] }

    // ── PASO 3: Extraer monto con regex ──
    const textoCompleto = data.texto_completo || JSON.stringify(data)
    const { monto_total, moneda } = extraerMonto(textoCompleto)
    debugLog.push({ campo: 'monto', monto_total, moneda })

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

    // ── PASO 6: Match girador ──
    const girCandidatos = [...(candidatos.giradores || []), data.nombre_girador].filter(Boolean)
    const girMatch = matchConLista(girCandidatos, refGir || [], 'nombre')
    debugLog.push({ campo: 'girador', detectado: data.nombre_girador, candidatos: candidatos.giradores, match: girMatch.nombre, fuente: girMatch.fuente })

    // ── PASO 7: Match taller ──
    const tallCandidatos = [...(candidatos.talleres || []), data.taller_origen]
      .filter(Boolean)
      .filter((t: string) => !estaProhibido(t))
    const tallMatch = matchConLista(tallCandidatos, refTall || [], 'nombre')
    debugLog.push({ campo: 'taller', detectado: data.taller_origen, candidatos: candidatos.talleres, match: tallMatch.nombre, fuente: tallMatch.fuente })

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
