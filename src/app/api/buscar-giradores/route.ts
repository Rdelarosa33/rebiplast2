// =============================================================
// API: Buscar giradores por aseguradora (autocomplete)
// =============================================================
// GET /api/buscar-giradores?q=texto&aseguradora=MAPFRE
// Retorna: { giradores: ["Nombre 1", "Nombre 2"] }
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
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''
    const aseguradora = (searchParams.get('aseguradora') || '').toUpperCase()

    // Mínimo 2 caracteres
    if (q.length < 2) {
      return NextResponse.json({ giradores: [] })
    }

    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Cargar giradores filtrados por aseguradora si la pasaron
    let query = supabase.from('ref_giradores').select('nombre, aseguradora, alias').eq('activo', true)
    if (aseguradora) {
      query = query.eq('aseguradora', aseguradora)
    }
    const { data, error } = await query
    if (error) {
      console.error('buscar-giradores error:', error)
      return NextResponse.json({ giradores: [] })
    }

    const giradores = data || []
    const qNorm = normalizar(q)
    const resultados: { nombre: string; relevancia: number }[] = []

    for (const g of giradores) {
      const nombreNorm = normalizar(g.nombre || '')
      const aliasNorm: string[] = (g.alias || []).map((a: string) => normalizar(a))

      let relevancia = 0
      // Match exacto al inicio
      if (nombreNorm.startsWith(qNorm)) relevancia = 100
      // Match en cualquier parte del nombre
      else if (nombreNorm.includes(qNorm)) relevancia = 50
      // Match en alias
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

    return NextResponse.json({
      giradores: resultados.slice(0, 10).map(r => r.nombre),
    })
  } catch (e: any) {
    console.error('buscar-giradores error:', e)
    return NextResponse.json({ giradores: [], error: e.message }, { status: 500 })
  }
}
