// =============================================================
// API: Buscar piezas en catálogo (autocomplete + match exacto)
// =============================================================
// GET /api/buscar-piezas?q=texto
// Retorna: {
//   match_exacto: { sigla, nombre_completo } | null,
//   sugerencias: [{ sigla, nombre_completo }]
// }
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

// Calcula relevancia de match entre input y un registro de pieza
function relevancia(input: string, nombre: string, sigla: string, alias: string[]): number {
  const inN = normalizar(input)
  const nomN = normalizar(nombre)
  const sigN = normalizar(sigla)
  const aliasN = (alias || []).map(a => normalizar(a))

  // Match exacto en sigla = MÁXIMO
  if (inN === sigN) return 1000
  // Match exacto en nombre completo
  if (inN === nomN) return 950
  // Match exacto en algún alias
  if (aliasN.some(a => a === inN)) return 900

  // Match por palabras: el input contiene TODAS las palabras del nombre
  const palabrasInput = inN.split(' ').filter(p => p.length > 2)
  const palabrasNombre = nomN.split(' ').filter(p => p.length > 2)
  if (palabrasInput.length >= 2 && palabrasNombre.length >= 2) {
    const todasInputEnNombre = palabrasInput.every(p => palabrasNombre.includes(p))
    const todasNombreEnInput = palabrasNombre.every(p => palabrasInput.includes(p))
    if (todasNombreEnInput) return 800  // Input contiene todas las palabras del nombre
    if (todasInputEnNombre) return 700  // Nombre contiene todas las palabras del input
  }

  // Match parcial (uno contiene al otro)
  if (inN.length >= 3) {
    if (nomN.includes(inN)) return 60
    if (sigN.includes(inN)) return 80
    if (inN.includes(sigN) && sigN.length >= 3) return 50
    if (inN.includes(nomN) && nomN.length >= 3) return 40
    if (aliasN.some(a => a.includes(inN) || inN.includes(a))) return 30
  }

  // Empieza con el input
  if (sigN.startsWith(inN)) return 90
  if (nomN.startsWith(inN)) return 70

  return 0
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || ''

    if (q.length < 2) {
      return NextResponse.json({ match_exacto: null, sugerencias: [] })
    }

    const supabase = createSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let piezas: any[] = []
    const { data, error } = await supabase.from('ref_piezas')
      .select('nombre_completo, sigla, alias')
      .eq('activo', true)
    if (error || !data) {
      // Fallback sin alias por si la columna no existe
      const { data: data2 } = await supabase.from('ref_piezas')
        .select('nombre_completo, sigla')
        .eq('activo', true)
      piezas = data2 || []
    } else {
      piezas = data
    }

    // Calcular relevancia para todas
    const conRelevancia = piezas
      .map(p => ({
        nombre_completo: p.nombre_completo,
        sigla: p.sigla,
        rel: relevancia(q, p.nombre_completo, p.sigla, p.alias || []),
      }))
      .filter(p => p.rel > 0)
      .sort((a, b) => b.rel - a.rel)

    // Match exacto: solo si la mejor sugerencia tiene relevancia >= 700 (palabras todas coinciden o exacto)
    const mejor = conRelevancia[0]
    const matchExacto = (mejor && mejor.rel >= 700)
      ? { sigla: mejor.sigla, nombre_completo: mejor.nombre_completo }
      : null

    // Top 10 sugerencias
    const sugerencias = conRelevancia.slice(0, 10).map(p => ({
      sigla: p.sigla,
      nombre_completo: p.nombre_completo,
    }))

    return NextResponse.json({
      match_exacto: matchExacto,
      sugerencias,
    })
  } catch (e: any) {
    console.error('buscar-piezas error:', e)
    return NextResponse.json({ match_exacto: null, sugerencias: [], error: e.message }, { status: 500 })
  }
}
