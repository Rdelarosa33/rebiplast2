import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EntregarClient from './EntregarClient'

export default async function EntregarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['recojo', 'recojo_trabajador', 'admin', 'mantenimiento'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const { data: piezas } = await supabase
    .from('piezas')
    .select(`
      id, nombre, lado, tipo_trabajo, precio,
      siniestro:siniestros (
        id, numero_siniestro, numero_orden,
        marca, placa, taller_origen, tipo_seguro
      )
    `)
    .eq('estado', 'LISTO_ENTREGA')
    .order('updated_at', { ascending: false })

  return <EntregarClient piezas={(piezas as any) || []} />
}
