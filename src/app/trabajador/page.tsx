import { getCurrentUser } from '@/lib/actions'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MisPiezasClient from './MisPiezasClient'

export const revalidate = 0

export default async function TrabajadorPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  // Piezas activas del trabajador
  const { data: piezasActivas } = await supabase
    .from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro, placa, tipo_seguro), historial:historial_piezas(accion, estado_nuevo, motivo, usuario_nombre, created_at)')
    .in('estado', ['ASIGNADO', 'EN_REPARACION', 'EN_PREPARACION', 'EN_PINTURA', 'EN_PULIDO'])
    .eq('trabajador_reparacion_id', profile.id)
    .order('updated_at', { ascending: false })

  // Piezas terminadas (CONTROL_CALIDAD, LISTO_ENTREGA, ENTREGADO) por este trabajador
  const { data: piezasTerminadas } = await supabase
    .from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro, placa, tipo_seguro), historial:historial_piezas(accion, estado_nuevo, motivo, usuario_nombre, created_at)')
    .in('estado', ['CONTROL_CALIDAD', 'LISTO_ENTREGA', 'ENTREGADO'])
    .eq('trabajador_reparacion_id', profile.id)
    .order('updated_at', { ascending: false })

  return (
    <MisPiezasClient
      profile={profile}
      piezasActivas={piezasActivas || []}
      piezasTerminadas={piezasTerminadas || []}
    />
  )
}
