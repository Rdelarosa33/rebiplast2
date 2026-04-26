import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import DashboardLayout from '../dashboard/layout'

export default async function TrabajadorLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUser()
  let habilitadoRecojo = false
  
  if (profile?.role === 'trabajador') {
    const supabase = await createClient()
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('habilitaciones_recojo')
      .select('id').eq('trabajador_id', profile.id).eq('fecha', hoy).maybeSingle()
    habilitadoRecojo = !!data
  }

  return <DashboardLayout habilitadoRecojo={habilitadoRecojo}>{children}</DashboardLayout>
}
