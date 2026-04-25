import { createClient } from '@/lib/supabase/server'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { Package, Clock, ShieldCheck, CheckCircle, Users, AlertTriangle } from 'lucide-react'
import AsignarPieza from './AsignarPieza'

export const revalidate = 0

export default async function DashboardSupervisor() {
  const supabase = await createClient()

  const [
    { data: porRecibir },
    { data: recibidas },
    { data: enCalidad },
    { data: listos },
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
    // Trabajadores
    supabase.from('profiles')
      .select('id, nombre, apellido, role')
      .in('role', ['trabajador', 'recojo_trabajador', 'supervisor'])
      .eq('activo', true).order('nombre'),
    // Carga laboral
    supabase.from('piezas')
      .select('trabajador_reparacion_id')
      .in('estado', ['ASIGNADO', 'EN_REPARACION', 'EN_PREPARACION', 'EN_PINTURA', 'EN_PULIDO', 'CONTROL_CALIDAD']),
  ])

  const cargaPorTrabajador: Record<string, number> = {}
  cargaData?.forEach((p: any) => {
    if (p.trabajador_reparacion_id) {
      cargaPorTrabajador[p.trabajador_reparacion_id] = (cargaPorTrabajador[p.trabajador_reparacion_id] || 0) + 1
    }
  })

  const trabajadoresConCarga = (trabajadores || []).map((t: any) => ({
    ...t,
    carga: cargaPorTrabajador[t.id] || 0
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

      {/* Carga laboral */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Carga laboral</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {trabajadoresConCarga.map((t: any) => (
            <div key={t.id} className={`p-3 rounded-xl border ${
              t.carga === 0 ? 'bg-green-500/10 border-green-500/30' :
              t.carga <= 2 ? 'bg-amber-500/10 border-amber-500/30' :
              'bg-red-500/10 border-red-500/30'
            }`}>
              <p className="text-sm font-medium text-white">{t.nombre}</p>
              <p className="text-xs text-[#475569]">{t.apellido}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div className={`w-2 h-2 rounded-full ${
                  t.carga === 0 ? 'bg-green-400' :
                  t.carga <= 2 ? 'bg-amber-400' : 'bg-red-400'
                }`} />
                <span className={`text-xs font-semibold ${
                  t.carga === 0 ? 'text-green-400' :
                  t.carga <= 2 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {t.carga === 0 ? 'Libre' : `${t.carga} pieza${t.carga > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Por recibir */}
      {(porRecibir?.length || 0) > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Package size={18} className="text-blue-400" />
            <h2 className="font-syne font-semibold text-white">Por recibir</h2>
            <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full ml-auto">{porRecibir?.length}</span>
          </div>
          <div className="space-y-2">
            {porRecibir?.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                  <p className="text-xs text-[#475569]">
                    <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                    {' · '}{p.siniestro?.placa}
                  </p>
                </div>
                <Link href={`/scan/${p.id}`} className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-500/30 transition-colors flex-shrink-0">
                  Confirmar recepción
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Por asignar */}
      {(recibidas?.length || 0) > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-violet-400" />
            <h2 className="font-syne font-semibold text-white">Por asignar</h2>
            <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full ml-auto">{recibidas?.length}</span>
          </div>
          <div className="space-y-3">
            {recibidas?.map((p: any) => (
              <div key={p.id} className="p-3 bg-[#131920] rounded-xl space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                    <p className="text-xs text-[#475569]">
                      {p.lado !== 'N/A' ? `${p.lado} · ` : ''}
                      <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                      {' · '}{p.siniestro?.placa}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                      {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                      {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                    </div>
                  </div>
                </div>
                <AsignarPieza piezaId={p.id} trabajadores={trabajadoresConCarga} />
              </div>
            ))}
          </div>
        </div>
      )}

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
