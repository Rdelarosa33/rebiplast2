import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReingresosClient from './ReingresosClient'

export default async function ReingresosSupervisorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['supervisor', 'admin', 'mantenimiento'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Cargar eventos no resueltos con datos de pieza y siniestro
  const { data: eventos } = await supabase
    .from('eventos_reingreso')
    .select(`
      id, motivo, comentario, fecha_entrega_original, fecha_reingreso, resuelto,
      pieza:piezas (
        id, nombre, lado, tipo_trabajo, estado,
        siniestro:siniestros (
          id, numero_siniestro, numero_orden, marca, placa, taller_origen, tipo_seguro
        )
      ),
      registrador:profiles!registrado_por (
        id, nombre, apellido
      )
    `)
    .eq('resuelto', false)
    .order('fecha_reingreso', { ascending: false })

  // Trabajadores disponibles
  const { data: trabajadores } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, role')
    .in('role', ['trabajador', 'recojo_trabajador'])
    .eq('activo', true)
    .order('nombre')

  return <ReingresosClient
    eventos={(eventos as any) || []}
    trabajadores={(trabajadores as any) || []}
  />
}
