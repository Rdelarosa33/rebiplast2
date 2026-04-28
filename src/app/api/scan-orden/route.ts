import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

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

Pieza: nombre, lado(LH=Izquierdo/RH=Derecho/DELT=Frontal/POST=Posterior/N/A), requiere_reparacion(REP), requiere_pintura(PINTURA/RP), es_faro(FARO/NEBLINERO), requiere_pulido(PULIDO/faro sin cambio), tipo_trabajo(R/P/RP/PU)
Ignorar: SUBTOTAL, IGV, TOTAL, Planchado/Pintura/Mecanica como categorias.

{"numero_siniestro":null,"numero_orden":null,"marca":null,"placa":null,"color":null,"tipo_seguro":null,"nombre_girador":null,"taller_origen":null,"datos_extra":{"expediente":null,"poliza":null,"modelo":null,"anio":null,"vin":null,"nombre_asegurado":null,"telefono_asegurado":null,"observaciones_orden":null},"candidatos":{"seguros":[],"giradores":[],"talleres":[]},"piezas":[{"nombre":"","lado":"N/A","requiere_reparacion":false,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":null}]}`

function limpiarJSON(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

// ============================================================
// OPTIMIZAR IMAGEN
// ============================================================
async function optimizarImagen(bytes: ArrayBuffer): Promise<{ base64: string; mimeType: string }> {
  try {
    const sharp = (await import('sharp')).default
    const optimized = await sharp(Buffer.from(bytes))
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 70 })
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

    // ── PASO 1: Verificar saldo antes de procesar ──
    const { data: cred } = await supabase.from('creditos_ocr').select('id, saldo').single()
    if (cred && cred.saldo < 0.50) {
      return NextResponse.json({ error: 'Saldo OCR insuficiente. Recarga tus créditos.' }, { status: 402 })
    }

    // ── PASO 2: GPT extrae datos y candidatos ──
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        temperature: 0,
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

    const jsonText = limpiarJSON(result.choices?.[0]?.message?.content || '')
    const data = JSON.parse(jsonText)
    const candidatos = data.candidatos || { seguros: [], giradores: [], talleres: [] }

    // ── PASO 3: Extraer monto con regex ──
    const textoCompleto = data.texto_completo || JSON.stringify(data)
    const { monto_total, moneda } = extraerMonto(textoCompleto)
    debugLog.push({ campo: 'monto', monto_total, moneda })

    // ── PASO 4: Cargar tablas de referencia ──
    const [{ data: refAseg }, { data: refGir }, { data: refTall }] = await Promise.all([
      supabase.from('ref_aseguradoras').select('variante, tipo, alias'),
      supabase.from('ref_giradores').select('nombre, aseguradora, alias'),
      supabase.from('ref_talleres').select('nombre, alias'),
    ])

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
      ? (refAseg?.find(a => a.variante === segMatch.nombre)?.tipo || data.tipo_seguro)
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

    // ── PASO 10: Construir resultado final ──
    const output: any = {
      numero_siniestro: data.numero_siniestro || null,
      numero_orden: data.numero_orden || null,
      marca: data.marca || null,
      placa: data.placa || null,
      color: data.color || null,
      tipo_seguro: tipoSeguroFinal || null,
      nombre_girador: girMatch.nombre || (!estaProhibido(data.nombre_girador || '') ? data.nombre_girador : null),
      taller_origen: tallMatch.nombre || null, // solo tabla, no fallback GPT
      monto_total,
      moneda,
      observaciones,
      piezas: data.piezas || [],
      confianza: {
        seguro: segMatch.fuente,
        girador: girMatch.fuente,
        taller: tallMatch.fuente,
      }
    }

    // ── PASO 11: Registrar uso y descontar credito ──
    try {
      const COSTO = 0.50
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
      })
    } catch (e) {
      console.error('Error registrando uso OCR:', e)
    }

    return NextResponse.json({
      success: true,
      data: output,
      proveedor: 'gpt-4o-mini+refs',
      debug: debugLog
    })

  } catch (error: any) {
    console.error('Error scan-orden:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar' }, { status: 500 })
  }
}
