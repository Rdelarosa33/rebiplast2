import { createClient } from '@/lib/supabase/server'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { Package, Clock, ShieldCheck, CheckCircle, Users, AlertTriangle } from 'lucide-react'
import AsignarPieza from './AsignarPieza'
import PorAsignarList from './PorAsignarList'
import CargaLaboral from './CargaLaboral'
import { SeccionPorRecibir, SeccionPorAsignar } from './SeccionColapsable'

export const revalidate = 0

export default async function DashboardSupervisor() {
  const supabase = await createClient()

  const [
    { data: porRecibir },
    { data: recibidas },
    { data: enCalidad },
    { data: listos },
    { data: piezasActivas },
    { data: trabajadores },
    { data: cargaData },
  ] = await Promise.all([
    // Por recibir: en traslado
    supabase.from('piezas')
      .select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)')
      .eq('estado','EN_TRASLADO').order('created_at'),
    // Por asignar: recibidas O asignadas sin trabajador
    supabase.from('piezas')
      .select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)')
      .in('estado', ['RECIBIDO', 'ASIGNADO'])
      .is('trabajador_reparacion_id', null)
      .order('created_at'),
    // En control de calidad
    supabase.from('piezas')
      .select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)')
      .eq('estado','CONTROL_CALIDAD').order('updated_at', { ascending: false }),
    // Listas para entrega
    supabase.from('piezas')
      .select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)')
      .eq('estado','LISTO_ENTREGA').order('updated_at', { ascending: false }),
    // Siniestros con mezcla de asignados y sin asignar
    supabase.from('piezas')
      .select('siniestro_id, estado, trabajador_reparacion_id, siniestro:siniestros(numero_siniestro,placa)')
      .in('estado', ['RECIBIDO','ASIGNADO','EN_REPARACION','EN_PREPARACION','EN_PINTURA','EN_PULIDO']),
    // Trabajadores
    supabase.from('profiles')
      .select('id, nombre, apellido, role')
      .in('role', ['trabajador', 'recojo_trabajador', 'supervisor'])
      .eq('activo', true).order('nombre'),
    // Carga laboral con detalle de piezas
    supabase.from('piezas')
      .select('id, nombre, lado, estado, requiere_reparacion, requiere_pintura, requiere_pulido, trabajador_reparacion_id, siniestro:siniestros(numero_siniestro, placa)')
      .in('estado', ['ASIGNADO', 'EN_REPARACION', 'EN_PREPARACION', 'EN_PINTURA', 'EN_PULIDO', 'CONTROL_CALIDAD']),
  ])

  // Detectar siniestros con piezas mixtas (algunas asignadas, otras no)
  const siniestroMap: Record<string, { sin_asignar: number, con_asignar: number, info: any }> = {}
  piezasActivas?.forEach((p: any) => {
    if (!siniestroMap[p.siniestro_id]) {
      siniestroMap[p.siniestro_id] = { sin_asignar: 0, con_asignar: 0, info: p.siniestro }
    }
    if (!p.trabajador_reparacion_id) {
      siniestroMap[p.siniestro_id].sin_asignar++
    } else {
      siniestroMap[p.siniestro_id].con_asignar++
    }
  })
  const siniestrosIncompletos = Object.entries(siniestroMap)
    .filter(([_, v]) => v.sin_asignar > 0 && v.con_asignar > 0)
    .map(([id, v]) => ({ id, ...v }))

  const cargaPorTrabajador: Record<string, number> = {}
  const piezasPorTrabajador: Record<string, any[]> = {}
  cargaData?.forEach((p: any) => {
    if (p.trabajador_reparacion_id) {
      cargaPorTrabajador[p.trabajador_reparacion_id] = (cargaPorTrabajador[p.trabajador_reparacion_id] || 0) + 1
      if (!piezasPorTrabajador[p.trabajador_reparacion_id]) piezasPorTrabajador[p.trabajador_reparacion_id] = []
      piezasPorTrabajador[p.trabajador_reparacion_id].push(p)
    }
  })

  const trabajadoresConCarga = (trabajadores || []).map((t: any) => ({
    ...t,
    carga: cargaPorTrabajador[t.id] || 0,
    piezas: piezasPorTrabajador[t.id] || []
  })).sort((a: any, b: any) => a.carga - b.carga)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Panel Supervisor</h1>
        <p className="text-sm text-[#475569] mt-0.5">Gestión de piezas y equipo</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Por recibir', value: porRecibir?.length || 0, color: 'text-blue-400' },
          { label: 'Por asignar', value: recibidas?.length || 0, color: 'text-violet-400' },
          { label: 'Control calidad', value: enCalidad?.length || 0, color: 'text-purple-400' },
          { label: 'Listo entrega', value: listos?.length || 0, color: 'text-green-400' },
        ].map(k => (
          <div key={k.label} className="card p-3 text-center">
            <p className={`text-2xl font-syne font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-[#475569] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Alerta siniestros incompletos */}
      {siniestrosIncompletos.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-400">
                {siniestrosIncompletos.length} siniestro{siniestrosIncompletos.length > 1 ? 's' : ''} con piezas sin asignar
              </p>
              <div className="mt-2 space-y-1">
                {siniestrosIncompletos.map((s: any) => (
                  <Link key={s.id} href={`/siniestros/${s.id}`}
                    className="flex items-center gap-2 hover:bg-amber-500/10 rounded-lg px-2 py-1 -mx-2 transition-colors">
                    <span className="text-xs font-mono text-amber-300">{s.info?.numero_siniestro}</span>
                    <span className="text-xs text-[#94A3B8]">{s.info?.placa}</span>
                    <span className="text-xs text-amber-400/70">— {s.sin_asignar} pieza{s.sin_asignar > 1 ? 's' : ''} sin asignar</span>
                    <span className="text-xs text-amber-400 ml-auto">Ver →</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carga laboral */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Carga laboral</h2>
        </div>
        <CargaLaboral trabajadores={trabajadoresConCarga} />
      </div>

      {(porRecibir?.length || 0) > 0 && <SeccionPorRecibir piezas={porRecibir || []} />}

      {(recibidas?.length || 0) > 0 && <SeccionPorAsignar piezas={recibidas || []} trabajadores={trabajadoresConCarga} />}

      {/* Control de calidad */}
      {(enCalidad?.length || 0) > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={18} className="text-purple-400" />
            <h2 className="font-syne font-semibold text-white">Control de calidad</h2>
            <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full ml-auto">{enCalidad?.length}</span>
          </div>
          <div className="space-y-2">
            {enCalidad?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                  <p className="text-xs text-[#475569]">
                    <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                    {' · '}{p.siniestro?.placa}
                  </p>
                  {p.trabajador_reparacion_nombre && (
                    <p className="text-xs text-[#475569]">Por: {p.trabajador_reparacion_nombre}</p>
                  )}
                </div>
                <Link href={`/scan/${p.id}`} className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/30 transition-colors flex-shrink-0">
                  Revisar
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listo para entrega */}
      {(listos?.length || 0) > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={18} className="text-green-400" />
            <h2 className="font-syne font-semibold text-white">Listo para entrega</h2>
            <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full ml-auto">{listos?.length}</span>
          </div>
          <div className="space-y-2">
            {listos?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                  <p className="text-xs text-[#475569]">
                    <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                    {' · '}{p.siniestro?.placa}
                  </p>
                </div>
                <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                  Listo
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!porRecibir?.length && !recibidas?.length && !enCalidad?.length && !listos?.length && (
        <div className="card p-12 text-center">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-3" />
          <p className="text-white font-semibold">Todo al día</p>
          <p className="text-sm text-[#475569] mt-1">No hay piezas pendientes</p>
        </div>
      )}
    </div>
  )
}
