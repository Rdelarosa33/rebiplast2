import { createClient } from '@/lib/supabase/server'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { Package, Clock, ShieldCheck, CheckCircle } from 'lucide-react'

export default async function DashboardSupervisor() {
  const supabase = await createClient()
  const [{ data: porRecibir }, { data: porAsignar }, { data: enCalidad }, { data: listos }] = await Promise.all([
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','EN_TRASLADO').order('created_at'),
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','RECIBIDO').order('created_at'),
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','CONTROL_CALIDAD').order('updated_at', { ascending: false }),
    supabase.from('piezas').select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen)').eq('estado','LISTO_ENTREGA').order('updated_at', { ascending: false }),
  ])

  const Section = ({ title, piezas, icon: Icon, color, emptyMsg }: any) => (
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
            <Link key={p.id} href={`/scan/${p.id}`}
              className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl hover:bg-[#1A2332] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                <p className="text-xs text-[#475569]">
                  {p.lado !== 'N/A' ? `${p.lado} · ` : ''}
                  <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                  {' · '}{p.siniestro?.placa}
                </p>
              </div>
              <span className={`badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]} text-xs flex-shrink-0`}>
                {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}
              </span>
            </Link>
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
      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Por recibir" piezas={porRecibir} icon={Package} color="text-blue-400" emptyMsg="No hay piezas en traslado" />
        <Section title="Por asignar" piezas={porAsignar} icon={Clock} color="text-violet-400" emptyMsg="No hay piezas sin asignar" />
        <Section title="Control de calidad" piezas={enCalidad} icon={ShieldCheck} color="text-purple-400" emptyMsg="No hay piezas en calidad" />
        <Section title="Listo para entrega" piezas={listos} icon={CheckCircle} color="text-green-400" emptyMsg="No hay piezas listas" />
      </div>
    </div>
  )
}
