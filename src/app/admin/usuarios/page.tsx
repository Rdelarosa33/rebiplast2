import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import UsuariosClient from './UsuariosClient'

export const revalidate = 0

export default async function UsuariosPage() {
  const profile = await getCurrentUser()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: usuarios } = await supabase
    .from('profiles')
    .select('*')
    .neq('role', 'mantenimiento')   // Admin NO debe ver usuarios mantenimiento
    .order('role')
    .order('nombre')

  return <UsuariosClient usuarios={usuarios || []} />
}
