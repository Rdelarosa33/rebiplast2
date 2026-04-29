// =============================================================
// API: Buscar giradores - VERSION DEBUG TEMPORAL
// =============================================================
// GET /api/buscar-giradores?q=fer&debug=1  ← agrega &debug=1
// =============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabase } from '@supabase/supabase-js'

function normalizar(texto: string): string {
  return (texto || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const aseguradora = (searchParams.get('aseguradora') || '').toUpperCase()
  const debug = searchParams.get('debug') === '1'

  const debugInfo: any = {
    q_recibida: q,
    aseguradora_recibida: aseguradora,
    paso: 'inicio',
  }

  try {
    if (q.length < 2) {
      debugInfo.paso = 'q_muy_corta'
      return NextResponse.json({ giradores: [], ...(debug ? { debug: debugInfo } : {}) })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    debugInfo.tiene_url = !!supabaseUrl
    debugInfo.tiene_key = !!supabaseKey

    if (!supabaseUrl || !supabaseKey) {
      debugInfo.paso = 'falta_env'
      return NextResponse.json({ giradores: [], ...(debug ? { debug: debugInfo } : {}) })
    }

    const supabase = createSupabase(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // PASO 1: SELECT sin filtros
    const { data: todos, error: errTodos } = await supabase
      .from('ref_giradores')
      .select('nombre, aseguradora, alias, activo')

    debugInfo.total_sin_filtros = todos?.length || 0
    debugInfo.error_sin_filtros = errTodos?.message || null
    if (todos && todos.length > 0) {
      debugInfo.primer_registro = todos[0]
      debugInfo.aseguradoras_distintas = Array.from(new Set(todos.map((t: any) => t.aseguradora)))
      debugInfo.tipos_activo = Array.from(new Set(todos.map((t: any) => t.activo)))
    }

    // PASO 2: con filtro activo
    const { data: activos, error: errActivos } = await supabase
      .from('ref_giradores')
      .select('nombre, aseguradora, alias')
      .eq('activo', true)
    debugInfo.total_activos = activos?.length || 0
    debugInfo.error_activos = errActivos?.message || null

    // PASO 3: con filtro aseguradora
    let datos: any[] = activos || []
    if (aseguradora) {
      const { data: filtrados, error: errFiltro } = await supabase
        .from('ref_giradores')
        .select('nombre, aseguradora, alias')
        .eq('activo', true)
        .eq('aseguradora', aseguradora)

      debugInfo.total_filtrado_aseg = filtrados?.length || 0
      debugInfo.error_filtro = errFiltro?.message || null
      datos = filtrados || []
    }

    // PASO 4: Match
    const qNorm = normalizar(q)
    debugInfo.q_normalizada = qNorm

    const resultados: { nombre: string; relevancia: number }[] = []
    for (const g of datos) {
      const nombreNorm = normalizar(g.nombre || '')
      const aliasNorm: string[] = (g.alias || []).map((a: string) => normalizar(a))

      let relevancia = 0
      if (nombreNorm.startsWith(qNorm)) relevancia = 100
      else if (nombreNorm.includes(qNorm)) relevancia = 50
      else if (aliasNorm.some(a => a.startsWith(qNorm))) relevancia = 30
      else if (aliasNorm.some(a => a.includes(qNorm))) relevancia = 20

      if (relevancia > 0) {
        resultados.push({ nombre: g.nombre, relevancia })
      }
    }

    resultados.sort((a, b) => {
      if (b.relevancia !== a.relevancia) return b.relevancia - a.relevancia
      return a.nombre.localeCompare(b.nombre)
    })

    debugInfo.matches_encontrados = resultados.length
    debugInfo.paso = 'fin_ok'

    return NextResponse.json({
      giradores: resultados.slice(0, 10).map(r => r.nombre),
      ...(debug ? { debug: debugInfo } : {}),
    })
  } catch (e: any) {
    debugInfo.paso = 'excepcion'
    debugInfo.error_msg = e?.message || String(e)
    return NextResponse.json(
      { giradores: [], error: e?.message, ...(debug ? { debug: debugInfo } : {}) },
      { status: 500 }
    )
  }
}
