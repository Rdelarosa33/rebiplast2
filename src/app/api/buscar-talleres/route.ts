// =============================================================
// API: Buscar talleres por texto parcial (autocomplete)
// =============================================================
// GET /api/buscar-talleres?q=texto
// Retorna: { talleres: [{ nombre, alias }] }
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

    // Mínimo 2 caracteres
    if (q.length < 2) {
      return NextResponse.json({ talleres: [] })
    }

    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Cargar todos los talleres y filtrar en memoria
    // (con 287 talleres, esto es trivialmente rápido)
    let talleres: any[] = []
    const { data, error } = await supabase.from('ref_talleres').select('nombre, alias')
    if (error) {
      // Fallback sin alias por si la columna no existe
      const { data: data2 } = await supabase.from('ref_talleres').select('nombre')
      talleres = data2 || []
    } else {
      talleres = data || []
    }

    const qNorm = normalizar(q)
    const resultados: { nombre: string; relevancia: number }[] = []

    for (const t of talleres) {
      const nombreNorm = normalizar(t.nombre || '')
      const aliasNorm: string[] = (t.alias || []).map((a: string) => normalizar(a))

      // Calcular relevancia
      let relevancia = 0

      // 1. Match exacto al inicio del nombre = mayor relevancia
      if (nombreNorm.startsWith(qNorm)) relevancia = 100
      // 2. Match en cualquier parte del nombre
      else if (nombreNorm.includes(qNorm)) relevancia = 50
      // 3. Match en alias
      else if (aliasNorm.some(a => a.startsWith(qNorm))) relevancia = 30
      else if (aliasNorm.some(a => a.includes(qNorm))) relevancia = 20

      if (relevancia > 0) {
        resultados.push({ nombre: t.nombre, relevancia })
      }
    }

    // Ordenar por relevancia y luego alfabético
    resultados.sort((a, b) => {
      if (b.relevancia !== a.relevancia) return b.relevancia - a.relevancia
      return a.nombre.localeCompare(b.nombre)
    })

    // Top 10
    return NextResponse.json({
      talleres: resultados.slice(0, 10).map(r => r.nombre),
    })
  } catch (e: any) {
    console.error('buscar-talleres error:', e)
    return NextResponse.json({ talleres: [], error: e.message }, { status: 500 })
  }
}
