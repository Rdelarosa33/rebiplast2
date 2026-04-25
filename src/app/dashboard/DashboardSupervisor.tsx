import { createClient } from '@/lib/supabase/server'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { Package, Clock, ShieldCheck, CheckCircle, Users } from 'lucide-react'
import AsignarPieza from './AsignarPieza'

export default async function DashboardSupervisor() {
  const supabase = await createClient()

  const [
    { data: porRecibir },
    { data: porAsignar },
    { data: enCalidad },
    { data: listos },
    { data: trabajadores },
  ] = await Promise.all([
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','EN_TRASLADO').order('created_at'),
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','RECIBIDO').order('created_at'),
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','CONTROL_CALIDAD').order('updated_at', { ascending: false }),
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','LISTO_ENTREGA').order('updated_at', { ascending: false }),
    supabase.from('profiles').select('id, nombre, apellido, role').in('role', ['trabajador', 'recojo_trabajador']).eq('activo', true).order('nombre'),
  ])

  // Obtener carga laboral de cada trabajador — cuenta todas las piezas activas asignadas
  const { data: cargaData } = await supabase
    .from('piezas')
    .select('trabajador_reparacion_id, estado')
    .in('estado', ['ASIGNADO', 'EN_REPARACION', 'EN_PREPARACION', 'EN_PINTURA', 'EN_PULIDO', 'CONTROL_CALIDAD'])

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

  const Section = ({ title, piezas, icon: Icon, color, emptyMsg, showAsignar }: any) => (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className={color} />
        <h2 className="font-syne font-semibold text-white">{title}</h2>
        <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full ml-auto">{piezas?.length || 0}</span>
      </div>
      {!piezas?.length ? (
        <p className="text-sm text-[#475569] text-center py-4">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {piezas.map((p: any) => (
            <div key={p.id} className="p-3 bg-[#131920] rounded-xl space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                  <p className="text-xs text-[#475569]">
                    {p.lado !== 'N/A' ? `${p.lado} · ` : ''}
                    <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                    {' · '}{p.siniestro?.placa}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]} text-xs`}>
                    {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}
                  </span>
                  <Link href={`/scan/${p.id}`} className="text-xs text-[#00D4FF] hover:underline">Ver</Link>
                </div>
              </div>
              {showAsignar && (
                <AsignarPieza piezaId={p.id} trabajadores={trabajadoresConCarga} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Panel Supervisor</h1>
        <p className="text-sm text-[#475569] mt-0.5">Recepciones, asignaciones y control de calidad</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Por recibir', value: porRecibir?.length || 0, color: 'text-blue-400' },
          { label: 'Por asignar', value: porAsignar?.length || 0, color: 'text-violet-400' },
          { label: 'En calidad', value: enCalidad?.length || 0, color: 'text-purple-400' },
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
          <h2 className="font-syne font-semibold text-white">Carga laboral del equipo</h2>
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

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Por recibir" piezas={porRecibir} icon={Package} color="text-blue-400" emptyMsg="No hay piezas en traslado" showAsignar={false} />
        <Section title="Por asignar" piezas={porAsignar} icon={Clock} color="text-violet-400" emptyMsg="No hay piezas sin asignar" showAsignar={true} />
        <Section title="Control de calidad" piezas={enCalidad} icon={ShieldCheck} color="text-purple-400" emptyMsg="No hay piezas en calidad" showAsignar={false} />
        <Section title="Listo para entrega" piezas={listos} icon={CheckCircle} color="text-green-400" emptyMsg="No hay piezas listas" showAsignar={false} />
      </div>
    </div>
  )
}
