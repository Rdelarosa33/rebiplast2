import { createClient } from '@/lib/supabase/server'
import DashboardAdminClient from './DashboardAdminClient'

export const revalidate = 0

export default async function DashboardAdmin() {
  const supabase = await createClient()

  const [
    { data: piezasActivas },
    { data: piezasHoy },
    { data: piezas30dias },
    { data: siniestrosActivos },
    { data: siniestros30dias },
    { data: trabajadores },
    { data: rechazosCalidad },
    { data: piezasRendimiento },
  ] = await Promise.all([
    // Piezas en proceso ahora
    supabase.from('piezas').select('estado, trabajador_reparacion_id, trabajador_reparacion_nombre, updated_at')
      .in('estado', ['ASIGNADO','EN_REPARACION','EN_PREPARACION','EN_PINTURA','EN_PULIDO','CONTROL_CALIDAD','LISTO_ENTREGA']),
    // Piezas terminadas hoy
    supabase.from('piezas').select('updated_at, estado')
      .eq('estado', 'ENTREGADO')
      .gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    // Piezas últimos 30 días para gráfico
    supabase.from('piezas').select('updated_at, estado, siniestro:siniestros(tipo_seguro)')
      .eq('estado', 'ENTREGADO')
      .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Siniestros activos
    supabase.from('siniestros').select('id, tipo_seguro, created_at')
      .not('id', 'in', `(SELECT DISTINCT siniestro_id FROM piezas WHERE estado = 'ENTREGADO')`),
    // Siniestros últimos 30 días
    supabase.from('siniestros').select('tipo_seguro, fecha_recojo')
      .gte('fecha_recojo', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    // Trabajadores con carga
    supabase.from('profiles').select('id, nombre, apellido')
      .eq('role', 'trabajador').eq('activo', true),
    // Rechazos en calidad últimos 30 días
    supabase.from('historial_piezas').select('pieza_id, created_at')
      .eq('estado_nuevo', 'ASIGNADO')
      .not('motivo', 'is', null)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Rendimiento por trabajador — piezas entregadas con trabajador asignado
    supabase.from('piezas').select('trabajador_reparacion_id, trabajador_reparacion_nombre, updated_at, historial:historial_piezas(estado_nuevo, motivo, created_at)')
      .eq('estado', 'ENTREGADO')
      .not('trabajador_reparacion_id', 'is', null)
      .gte('updated_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  // Calcular carga por trabajador
  const cargaMap: Record<string, number> = {}
  piezasActivas?.forEach(p => {
    if (p.trabajador_reparacion_id) {
      cargaMap[p.trabajador_reparacion_id] = (cargaMap[p.trabajador_reparacion_id] || 0) + 1
    }
  })
  const trabajadoresConCarga = (trabajadores || []).map((t: any) => ({
    ...t,
    carga: cargaMap[t.id] || 0
  })).sort((a: any, b: any) => b.carga - a.carga)

  // Pipeline por estado
  const pipeline = {
    ASIGNADO: piezasActivas?.filter(p => p.estado === 'ASIGNADO').length || 0,
    EN_REPARACION: piezasActivas?.filter(p => p.estado === 'EN_REPARACION').length || 0,
    EN_PREPARACION: piezasActivas?.filter(p => p.estado === 'EN_PREPARACION').length || 0,
    EN_PINTURA: piezasActivas?.filter(p => p.estado === 'EN_PINTURA').length || 0,
    EN_PULIDO: piezasActivas?.filter(p => p.estado === 'EN_PULIDO').length || 0,
    CONTROL_CALIDAD: piezasActivas?.filter(p => p.estado === 'CONTROL_CALIDAD').length || 0,
    LISTO_ENTREGA: piezasActivas?.filter(p => p.estado === 'LISTO_ENTREGA').length || 0,
  }

  // Piezas sin asignar hace más de 24h
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const sinAsignarAtrasadas = piezasActivas?.filter(p =>
    p.estado === 'ASIGNADO' && !p.trabajador_reparacion_id && new Date(p.updated_at) < hace24h
  ).length || 0

  // Distribución por seguro
  const seguroMap: Record<string, number> = {}
  siniestros30dias?.forEach((s: any) => {
    const seg = s.tipo_seguro || 'OTRO'
    seguroMap[seg] = (seguroMap[seg] || 0) + 1
  })
  const porSeguro = Object.entries(seguroMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // Piezas por día últimos 14 días
  const hoy = new Date()
  const porDia = Array.from({ length: 14 }, (_, i) => {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() - (13 - i))
    const fechaStr = fecha.toISOString().split('T')[0]
    const count = piezas30dias?.filter(p => p.updated_at?.startsWith(fechaStr)).length || 0
    return {
      dia: fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }),
      piezas: count
    }
  })

  // Procesar rendimiento por trabajador
  const rendimientoMap: Record<string, any> = {}
  piezasRendimiento?.forEach((p: any) => {
    const id = p.trabajador_reparacion_id
    const nombre = p.trabajador_reparacion_nombre || 'Sin nombre'
    if (!rendimientoMap[id]) {
      rendimientoMap[id] = { id, nombre, terminadas: 0, devueltas: 0, tiempos: [] }
    }
    rendimientoMap[id].terminadas++
    const fueDevuelta = p.historial?.some((h: any) => h.estado_nuevo === 'ASIGNADO' && h.motivo)
    if (fueDevuelta) rendimientoMap[id].devueltas++
    // Tiempo desde inicio a entrega
    const inicio = p.historial?.find((h: any) => h.estado_nuevo === 'EN_REPARACION')
    if (inicio) {
      const horas = (new Date(p.updated_at).getTime() - new Date(inicio.created_at).getTime()) / (1000 * 60 * 60)
      if (horas > 0 && horas < 720) rendimientoMap[id].tiempos.push(horas)
    }
  })
  const rendimiento = Object.values(rendimientoMap).map((r: any) => ({
    ...r,
    calidad: r.terminadas > 0 ? Math.round(((r.terminadas - r.devueltas) / r.terminadas) * 100) : 100,
    tiempoPromedio: r.tiempos.length > 0 ? +(r.tiempos.reduce((a: number, b: number) => a + b, 0) / r.tiempos.length).toFixed(1) : null
  })).sort((a: any, b: any) => b.terminadas - a.terminadas)

  return (
    <DashboardAdminClient
      pipeline={pipeline}
      piezasActivasTotal={piezasActivas?.length || 0}
      terminadasHoy={piezasHoy?.length || 0}
      siniestrosActivos={siniestrosActivos?.length || 0}
      sinAsignarAtrasadas={sinAsignarAtrasadas}
      rechazosTotal={rechazosCalidad?.length || 0}
      terminadas30dias={piezas30dias?.length || 0}
      trabajadoresConCarga={trabajadoresConCarga}
      porSeguro={porSeguro}
      porDia={porDia}
      rendimiento={rendimiento}
    />
  )
}
