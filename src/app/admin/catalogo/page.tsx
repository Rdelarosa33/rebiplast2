import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CatalogoClient from './CatalogoClient'

export default async function CatalogoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'mantenimiento'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Cargar las 3 tablas en paralelo
  const [talleresRes, giradoresRes, piezasRes] = await Promise.all([
    supabase.from('ref_talleres').select('id, nombre, alias, activo').order('nombre'),
    supabase.from('ref_giradores').select('id, nombre, aseguradora, alias, activo').order('aseguradora').order('nombre'),
    supabase.from('ref_piezas').select('id, sigla, nombre_completo, alias, activo').order('sigla'),
  ])

  return (
    <CatalogoClient
      talleres={talleresRes.data || []}
      giradores={giradoresRes.data || []}
      piezas={piezasRes.data || []}
    />
  )
}
