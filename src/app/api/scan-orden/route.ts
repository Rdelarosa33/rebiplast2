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
  const norm = normalizar(texto)
  return PROHIBIDOS.some(p => norm.includes(p))
}

// ============================================================
// EXTRAER MONTO CON REGEX (más confiable que GPT)
// ============================================================
function extraerMonto(texto: string): { monto_total: number | null, moneda: string } {
  // Patrones priorizados: primero USD, luego PEN
  const patronesUSD = [
    /TOTAL\s+GENERAL\s*\$\s*([\d,]+\.?\d*)/i,
    /TOTAL\s+A\s+FACTURAR\s*\$\s*([\d,]+\.?\d*)/i,
    /TOTAL\s+MANO\s+DE\s+OBRA\s*\$\s*([\d,]+\.?\d*)/i,
    /SUBTOTAL\s*\$\s*([\d,]+\.?\d*)/i,
    /\$\s*([\d,]+\.?\d*)\s*$/im,
    /TOTAL[^S\n]*\$\s*([\d,]+\.?\d*)/i,
  ]
  const patronesPEN = [
    /TOTAL\s+GENERAL\s*S\/\s*([\d,]+\.?\d*)/i,
    /TOTAL\s+A\s+FACTURAR\s*S\/\s*([\d,]+\.?\d*)/i,
    /TOTAL\s+MANO\s+DE\s+OBRA\s*S\/\s*([\d,]+\.?\d*)/i,
    /S\/\s*([\d,]+\.?\d*)\s*$/im,
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
type MatchResult = { nombre: string; fuente: 'tabla_exacta' | 'tabla_alias' | 'tabla_parcial' | 'tabla_palabras' | 'gpt' | null }

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

      if (candNorm === nombreNorm) return { nombre, fuente: 'tabla_exacta' }
      if (alias.some(a => candNorm === a)) return { nombre, fuente: 'tabla_alias' }
      if (candNorm.includes(nombreNorm) || nombreNorm.includes(candNorm)) return { nombre, fuente: 'tabla_parcial' }
      if (alias.some(a => candNorm.includes(a) || a.includes(candNorm))) return { nombre, fuente: 'tabla_alias' }

      const palabrasNombre = nombreNorm.split(' ').filter(p => p.length > 2)
      const palabrasCand = candNorm.split(' ').filter(p => p.length > 2)
      const matches = palabrasNombre.filter(p => palabrasCand.includes(p))
      if (matches.length >= Math.min(1, palabrasNombre.length)) return { nombre, fuente: 'tabla_palabras' }
    }
  }

  return { nombre: '', fuente: null }
}

// ============================================================
// PROMPT — solo campos que GPT extrae bien
// ============================================================
const PROMPT = `Lee esta orden de trabajo automotriz peruana. Devuelve SOLO JSON válido.

PASO 1 - IDENTIFICAR EMISOR:
El emisor es la empresa/institución que aparece en el encabezado principal (logo o nombre destacado).
Aseguradoras conocidas: RIMAC, MAPFRE, PACIFICO, EA Corp, LA POSITIVA, HDI
- Si el emisor ES aseguradora → tipo_seguro=emisor, buscar taller DENTRO de la orden
- Si el emisor NO es aseguradora (ej: Qualitat, cualquier taller) → taller_origen=emisor, buscar seguro DENTRO de la orden

PASO 2 - EXTRAER CAMPOS:
numero_siniestro: campo Siniestro/Caso - solo el numero, NO descripcion
numero_orden: campo NRO DE OC/OTR.../OC-/Folio/ORDEN DE TRABAJO Nro. - NO usar NumOS
marca, placa(ABC123 o ABC1234), color
nombre_girador: nombre de PERSONA (no direccion ni empresa) junto a Tecnico/Perito/Asesor/Realizado por/VoBo/Jefe de Siniestros/firma. Ignorar direcciones y RUC.
taller_origen: si emisor es aseguradora → buscar en TALLER PRINCIPAL/ATENCION A TALLER/Cliente. NUNCA usar REBIPLAST.
tipo_seguro: RIMAC/MAPFRE/PACIFICO/LA_POSITIVA/HDI/INTERSEGURO/TALLER/OTRO
datos_extra: expediente, poliza, modelo, anio, vin, nombre_asegurado, telefono_asegurado, observaciones_orden

CANDIDATOS (todo lo que veas aunque no estés seguro):
candidatos.seguros, candidatos.giradores, candidatos.talleres(excepto REBIPLAST)

PASO 3 - PIEZAS:
Cada linea = UNA pieza, NO agrupar. Revisar siempre Observaciones para piezas adicionales.
MAPFRE: cada "REP xxx" = pieza separada
RIMAC: cada fila descripcion/SERVICIO = pieza
LA_POSITIVA: cada fila tabla Reparacion/Descripcion = pieza
PACIFICO/EA Corp: cada fila OPERACION/DESCRIPCION = pieza
Qualitat/INTERSEGURO: piezas SOLO en Observaciones (ej: "OT POR REPUESTO: FUNDA POST SUP" → pieza="FUNDA POST SUP"). Ignorar tabla de montos (Planchado/Pintura/Mecanica son categorias NO piezas).

Campos pieza: nombre, lado(LH=Izquierdo/RH=Derecho/DELT=Frontal/POST=Posterior/N/A), requiere_reparacion(REP), requiere_pintura(PINTURA/RP), es_faro(FARO/NEBLINERO), requiere_pulido(PULIDO/faro sin cambio), tipo_trabajo(R/P/RP/PU)
Ignorar: SUBTOTAL, IGV, TOTAL, filas vacias.

{"numero_siniestro":null,"numero_orden":null,"marca":null,"placa":null,"color":null,"tipo_seguro":null,"nombre_girador":null,"taller_origen":null,"datos_extra":{"expediente":null,"poliza":null,"modelo":null,"anio":null,"vin":null,"nombre_asegurado":null,"telefono_asegurado":null,"observaciones_orden":null},"candidatos":{"seguros":[],"giradores":[],"talleres":[]},"piezas":[{"nombre":"","lado":"N/A","requiere_reparacion":false,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":null}]}`

function limpiarJSON(text: string): string {
  return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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
    const base64 = Buffer.from(bytes).toString('base64')

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY no configurada')

    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── PASO 1: GPT extrae datos y candidatos ──
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64}`, detail: 'high' } },
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

    // ── PASO 2: Extraer monto con regex de todos los campos de texto ──
    const textoParaMonto = [
      data.texto_completo,
      data.taller_origen,
      data.observaciones,
      data.datos_extra?.observaciones_orden,
      ...(data.piezas || []).map((p: any) => p.nombre)
    ].filter(Boolean).join(' ')
    // Intentar con texto de GPT, si falla buscar en JSON completo
    const jsonStr = JSON.stringify(data)
    const { monto_total, moneda } = extraerMonto(textoParaMonto) || extraerMonto(jsonStr)
    debugLog.push({ campo: 'monto', texto_buscado: textoParaMonto.slice(0, 200), monto_total, moneda })

    // ── PASO 3: Cargar tablas de referencia ──
    const [{ data: refAseg }, { data: refGir }, { data: refTall }] = await Promise.all([
      supabase.from('ref_aseguradoras').select('variante, tipo, alias'),
      supabase.from('ref_giradores').select('nombre, aseguradora, alias'),
      supabase.from('ref_talleres').select('nombre, alias'),
    ])

    // ── PASO 4: Match seguro ──
    const segCandidatos = [...(candidatos.seguros || []), data.tipo_seguro].filter(Boolean)
    const segMatch = matchConLista(segCandidatos, refAseg || [], 'variante')
    debugLog.push({ campo: 'seguro', detectado: data.tipo_seguro, candidatos: candidatos.seguros, match: segMatch.nombre, fuente: segMatch.fuente })

    // ── PASO 5: Match girador ──
    const girCandidatos = [...(candidatos.giradores || []), data.nombre_girador].filter(Boolean)
    const girMatch = matchConLista(girCandidatos, refGir || [], 'nombre')
    debugLog.push({ campo: 'girador', detectado: data.nombre_girador, candidatos: candidatos.giradores, match: girMatch.nombre, fuente: girMatch.fuente })

    // ── PASO 6: Match taller ──
    // Si la imagen tiene EA Corp en el encabezado, agregarlo como candidato prioritario
    const eaCorpCandidato = (data.texto_completo || '').toUpperCase().includes('EA CORP') ? 'EA Corp SAC' : null
    const tallCandidatos = [
      eaCorpCandidato,
      ...(candidatos.talleres || []),
      data.taller_origen
    ].filter(Boolean).filter((t: string) => !estaProhibido(t))
    const tallMatch = matchConLista(tallCandidatos, refTall || [], 'nombre')
    debugLog.push({ campo: 'taller', detectado: data.taller_origen, candidatos: candidatos.talleres, match: tallMatch.nombre, fuente: tallMatch.fuente })

    // ── PASO 7: Inferir seguro desde girador si no se encontró ──
    let tipoSeguroFinal = segMatch.nombre
      ? (refAseg?.find(a => a.variante === segMatch.nombre)?.tipo || data.tipo_seguro)
      : data.tipo_seguro

    if (!tipoSeguroFinal && girMatch.nombre) {
      const girReg = refGir?.find(g => g.nombre === girMatch.nombre)
      if (girReg?.aseguradora && girReg.aseguradora !== 'TALLER') {
        tipoSeguroFinal = girReg.aseguradora
        debugLog.push({ campo: 'seguro_inferido', desde: 'girador', valor: tipoSeguroFinal })
      }
    }

    // ── PASO 8: Construir observaciones concatenadas ──
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

    // ── PASO 9: Construir resultado final ──
    const output: any = {
      numero_siniestro: data.numero_siniestro || null,
      numero_orden: data.numero_orden || null,
      marca: data.marca || null,
      placa: data.placa || null,
      color: data.color || null,
      tipo_seguro: tipoSeguroFinal || data.tipo_seguro || null,
      nombre_girador: girMatch.nombre || (!estaProhibido(data.nombre_girador || '') ? data.nombre_girador : null),
      taller_origen: tallMatch.nombre || (!estaProhibido(data.taller_origen || '') ? data.taller_origen : null),
      monto_total,
      moneda,
      observaciones,
      piezas: data.piezas || [],
    }

    // ── PASO 10: Registrar uso y descontar credito ──
    try {
      const COSTO = 0.50
      const { data: cred } = await supabase.from('creditos_ocr').select('id, saldo').single()
      if (cred && cred.saldo < COSTO) {
        return NextResponse.json({ error: 'Saldo OCR insuficiente. Recarga tus créditos.' }, { status: 402 })
      }
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

    return NextResponse.json({ success: true, data: output, proveedor: 'gpt-4o-mini+refs', debug: debugLog })

  } catch (error: any) {
    console.error('Error scan-orden:', error)
    return NextResponse.json({ error: error.message || 'Error al procesar' }, { status: 500 })
  }
}
