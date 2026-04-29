import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReingresoClient from './ReingresoClient'

export default async function ReingresoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['recojo', 'recojo_trabajador', 'admin', 'mantenimiento'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Cargar piezas ENTREGADO recientes (para que recojo elija cuál marcar como reingreso)
  const { data: piezas } = await supabase
    .from('piezas')
    .select(`
      id, nombre, lado, tipo_trabajo, precio, updated_at,
      siniestro:siniestros (
        id, numero_siniestro, numero_orden,
        marca, placa, taller_origen, tipo_seguro
      )
    `)
    .eq('estado', 'ENTREGADO')
    .order('updated_at', { ascending: false })
    .limit(200)

  return <ReingresoClient piezas={(piezas as any) || []} />
}
