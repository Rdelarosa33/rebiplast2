'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type Tabla = 'ref_talleres' | 'ref_giradores' | 'ref_piezas'

async function verificarPermiso() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'mantenimiento'].includes(profile.role)) {
    throw new Error('Sin permisos')
  }
  return supabase
}

// ──────────────────────────────────────────────────────
// TALLERES
// ──────────────────────────────────────────────────────
export async function crearTaller(nombre: string, alias: string[]) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_talleres').insert({
    nombre: nombre.trim(),
    alias: alias.filter(a => a.trim()).map(a => a.trim()),
    activo: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function editarTaller(id: number, nombre: string, alias: string[]) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_talleres').update({
    nombre: nombre.trim(),
    alias: alias.filter(a => a.trim()).map(a => a.trim()),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function desactivarTaller(id: number) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_talleres').update({ activo: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function activarTaller(id: number) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_talleres').update({ activo: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

// ──────────────────────────────────────────────────────
// GIRADORES
// ──────────────────────────────────────────────────────
export async function crearGirador(nombre: string, aseguradora: string, alias: string[]) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_giradores').insert({
    nombre: nombre.trim(),
    aseguradora: aseguradora.toUpperCase().trim(),
    alias: alias.filter(a => a.trim()).map(a => a.trim()),
    activo: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function editarGirador(id: number, nombre: string, aseguradora: string, alias: string[]) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_giradores').update({
    nombre: nombre.trim(),
    aseguradora: aseguradora.toUpperCase().trim(),
    alias: alias.filter(a => a.trim()).map(a => a.trim()),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function desactivarGirador(id: number) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_giradores').update({ activo: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function activarGirador(id: number) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_giradores').update({ activo: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

// ──────────────────────────────────────────────────────
// PIEZAS
// ──────────────────────────────────────────────────────
export async function crearPieza(sigla: string, nombre_completo: string, alias: string[]) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_piezas').insert({
    sigla: sigla.toUpperCase().trim(),
    nombre_completo: nombre_completo.toUpperCase().trim(),
    alias: alias.filter(a => a.trim()).map(a => a.toUpperCase().trim()),
    activo: true,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function editarPieza(id: number, sigla: string, nombre_completo: string, alias: string[]) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_piezas').update({
    sigla: sigla.toUpperCase().trim(),
    nombre_completo: nombre_completo.toUpperCase().trim(),
    alias: alias.filter(a => a.trim()).map(a => a.toUpperCase().trim()),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function desactivarPieza(id: number) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_piezas').update({ activo: false }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}

export async function activarPieza(id: number) {
  const supabase = await verificarPermiso()
  const { error } = await supabase.from('ref_piezas').update({ activo: true }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/catalogo')
}
