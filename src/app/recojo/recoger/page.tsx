import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RecogerClient from './RecogerClient'

export default async function RecogerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['recojo', 'recojo_trabajador', 'admin', 'mantenimiento'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Cargar piezas REGISTRADO (en taller, falta traer)
  const { data: piezas } = await supabase
    .from('piezas')
    .select(`
      id, nombre, lado, tipo_trabajo, monto,
      siniestro:siniestros (
        id, numero_siniestro, numero_orden,
        marca, placa, taller_origen, tipo_seguro
      )
    `)
    .eq('estado', 'REGISTRADO')
    .order('created_at', { ascending: false })

  return <RecogerClient piezas={(piezas as any) || []} />
}
