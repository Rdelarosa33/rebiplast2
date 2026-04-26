import { createClient } from '@/lib/supabase/server'
import DashboardOwnerClient from './DashboardOwnerClient'

export const revalidate = 0

export default async function DashboardOwner() {
  const supabase = await createClient()

  const [
    { data: siniestrosMes },
    { data: siniestros3meses },
    { data: piezasEntregadas },
    { data: piezasActivas },
    { data: trabajadores },
    { data: rechazos },
  ] = await Promise.all([
    // Siniestros este mes
    supabase.from('siniestros').select('tipo_seguro, fecha_recojo, created_at')
      .gte('fecha_recojo', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
    // Siniestros últimos 3 meses
    supabase.from('siniestros').select('tipo_seguro, fecha_recojo')
      .gte('fecha_recojo', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    // Piezas entregadas últimos 30 días
    supabase.from('piezas').select('updated_at, trabajador_reparacion_id')
      .eq('estado', 'ENTREGADO')
      .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Piezas en proceso ahora
    supabase.from('piezas').select('estado')
      .in('estado', ['ASIGNADO','EN_REPARACION','EN_PREPARACION','EN_PINTURA','EN_PULIDO','CONTROL_CALIDAD','LISTO_ENTREGA']),
    // Trabajadores activos
    supabase.from('profiles').select('id, nombre').eq('role', 'trabajador').eq('activo', true),
    // Rechazos calidad último mes
    supabase.from('historial_piezas').select('created_at')
      .eq('estado_nuevo', 'ASIGNADO').not('motivo', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  // KPIs del mes
  const siniestrosMesCount = siniestrosMes?.length || 0
  const piezasEntregadasCount = piezasEntregadas?.length || 0
  const piezasActivasCount = piezasActivas?.length || 0
  const tasaCalidad = piezasEntregadasCount > 0
    ? Math.round(((piezasEntregadasCount - (rechazos?.length || 0)) / piezasEntregadasCount) * 100)
    : 100

  // Por seguro este mes
  const seguroMap: Record<string, number> = {}
  siniestrosMes?.forEach((s: any) => {
    seguroMap[s.tipo_seguro || 'OTRO'] = (seguroMap[s.tipo_seguro || 'OTRO'] || 0) + 1
  })
  const porSeguro = Object.entries(seguroMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Siniestros por semana últimos 3 meses
  const semanas: Record<string, number> = {}
  siniestros3meses?.forEach((s: any) => {
    const d = new Date(s.fecha_recojo)
    const semana = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`
    semana && (semanas[semana] = (semanas[semana] || 0) + 1)
  })
  const porSemana = Object.entries(semanas)
    .slice(-12)
    .map(([dia, count]) => ({ dia, count }))

  // Siniestros por mes
  const meses: Record<string, number> = {}
  siniestros3meses?.forEach((s: any) => {
    const d = new Date(s.fecha_recojo)
    const mes = d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' })
    meses[mes] = (meses[mes] || 0) + 1
  })
  const porMes = Object.entries(meses).map(([mes, count]) => ({ mes, count }))

  return (
    <DashboardOwnerClient
      siniestrosMes={siniestrosMesCount}
      piezasEntregadas={piezasEntregadasCount}
      piezasActivas={piezasActivasCount}
      tasaCalidad={tasaCalidad}
      trabajadoresActivos={trabajadores?.length || 0}
      porSeguro={porSeguro}
      porSemana={porSemana}
      porMes={porMes}
      rechazosTotal={rechazos?.length || 0}
    />
  )
}
