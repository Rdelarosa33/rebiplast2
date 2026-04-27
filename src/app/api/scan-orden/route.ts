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
// MATCH INTELIGENTE
// ============================================================
type MatchResult = { nombre: string; fuente: 'tabla_exacta' | 'tabla_alias' | 'tabla_parcial' | 'tabla_palabras' | 'gpt' | null }

function matchConLista(candidatos: string[], registros: any[], campoNombre: string): MatchResult {
  if (!candidatos?.length || !registros?.length) return { nombre: '', fuente: null }

  // Ordenar candidatos por longitud DESC (más específico primero)
  const cands = [...candidatos].sort((a, b) => b.length - a.length)

  for (const cand of cands) {
    if (!cand || estaProhibido(cand)) continue
    const candNorm = normalizar(cand)

    // Ordenar registros por longitud DESC
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

      // 5. Por palabras (split)
      const palabrasNombre = nombreNorm.split(' ').filter(p => p.length > 3)
      const palabrasCand = candNorm.split(' ').filter(p => p.length > 3)
      const matches = palabrasNombre.filter(p => palabrasCand.includes(p))
      if (matches.length >= Math.min(2, palabrasNombre.length)) {
        return { nombre, fuente: 'tabla_palabras' }
      }
    }
  }

  return { nombre: '', fuente: null }
}

// ============================================================
// PROMPT
// ============================================================
const PROMPT = `Lee esta orden de trabajo automotriz peruana.

Devuelve SOLO JSON válido.

CAMPOS PRINCIPALES:
- numero_siniestro, numero_orden, marca, placa, color
- tipo_seguro: RIMAC/MAPFRE/PACIFICO/LA_POSITIVA/HDI/INTERSEGURO/TALLER/OTRO
- nombre_girador: nombre junto a Tecnico/Perito/Asesor/Realizado por/VoBo/firma
- taller_origen: campo TALLER PRINCIPAL o ATENCION A TALLER (NO usar REBIPLAST)

CANDIDATOS - meter TODO lo que veas relevante aunque no estés seguro:
- candidatos.seguros: todos los logos/nombres de seguros visibles
- candidatos.giradores: todos los nombres de personas visibles
- candidatos.talleres: todos los nombres de talleres/empresas visibles (excepto REBIPLAST)

PIEZAS - CADA linea = UNA pieza separada:
- MAPFRE: cada linea REP = pieza independiente
- RIMAC: cada fila descripcion/SERVICIO = una pieza
- LA_POSITIVA: tabla Reparacion/Descripcion, cada fila = una pieza
- PACIFICO/EA Corp: tabla OPERACION/DESCRIPCION, cada fila = una pieza
- INTERSEGURO: piezas en Observaciones, separar por coma/guion/salto

Para cada pieza:
- nombre, lado (LH=Izquierdo/RH=Derecho/DELT=Frontal/POST=Posterior/N/A)
- requiere_reparacion, requiere_pintura, es_faro, requiere_pulido
- tipo_trabajo: RP/R/P/PU

JSON:
{"numero_siniestro":null,"numero_orden":null,"marca":null,"placa":null,"tipo_seguro":null,"nombre_girador":null,"taller_origen":null,"color":null,"candidatos":{"seguros":[],"giradores":[],"talleres":[]},"piezas":[{"nombre":"","lado":"N/A","requiere_reparacion":false,"requiere_pintura":false,"es_faro":false,"requiere_pulido":false,"tipo_trabajo":null}]}`

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

    // ── PASO 2: Cargar tablas de referencia ──
    const [{ data: refAseg }, { data: refGir }, { data: refTall }] = await Promise.all([
      supabase.from('ref_aseguradoras').select('variante, tipo, alias'),
      supabase.from('ref_giradores').select('nombre, aseguradora, alias'),
      supabase.from('ref_talleres').select('nombre, alias'),
    ])

    // ── PASO 3: Match seguro ──
    const segCandidatos = [
      ...(candidatos.seguros || []),
      data.tipo_seguro,
    ].filter(Boolean)

    const segMatch = matchConLista(segCandidatos, refAseg || [], 'variante')
    debugLog.push({ campo: 'seguro', detectado: data.tipo_seguro, candidatos: candidatos.seguros, match: segMatch.nombre, fuente: segMatch.fuente })

    // ── PASO 4: Match girador ──
    const girCandidatos = [
      ...(candidatos.giradores || []),
      data.nombre_girador,
    ].filter(Boolean)

    const girMatch = matchConLista(girCandidatos, refGir || [], 'nombre')
    debugLog.push({ campo: 'girador', detectado: data.nombre_girador, candidatos: candidatos.giradores, match: girMatch.nombre, fuente: girMatch.fuente })

    // ── PASO 5: Match taller ──
    const tallCandidatos = [
      ...(candidatos.talleres || []),
      data.taller_origen,
    ].filter(Boolean).filter(t => !estaProhibido(t))

    const tallMatch = matchConLista(tallCandidatos, refTall || [], 'nombre')
    debugLog.push({ campo: 'taller', detectado: data.taller_origen, candidatos: candidatos.talleres, match: tallMatch.nombre, fuente: tallMatch.fuente })

    // ── PASO 6: Si seguro no encontrado en tabla, buscar girador para inferir seguro ──
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

    // ── PASO 7: Construir resultado final ──
    // Prioridad: tabla > GPT > null
    const output = {
      ...data,
      tipo_seguro: tipoSeguroFinal || data.tipo_seguro || null,
      nombre_girador: girMatch.nombre || (data.nombre_girador && !estaProhibido(data.nombre_girador) ? data.nombre_girador : null),
      taller_origen: tallMatch.nombre || (data.taller_origen && !estaProhibido(data.taller_origen) ? data.taller_origen : null),
    }

    // Limpiar candidatos del output final
    delete output.candidatos

    // ── PASO 8: Registrar uso y descontar credito ──
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
