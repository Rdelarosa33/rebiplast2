import { createClient } from '@/lib/supabase/server'
import { ESTADO_LABELS, ESTADO_COLOR, PiezaEstado } from '@/types'
import { Package, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardAdmin() {
  const supabase = await createClient()
  const [{ data: piezas }, { data: siniestros }] = await Promise.all([
    supabase.from('piezas').select('estado, requiere_pintura, created_at'),
    supabase.from('siniestros').select('id, tipo_seguro, created_at').eq('activo', true),
  ])

  const total = piezas?.length || 0
  const enProceso = piezas?.filter(p => !['REGISTRADO','LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length || 0
  const listos = piezas?.filter(p => p.estado === 'LISTO_ENTREGA').length || 0
  const calidad = piezas?.filter(p => p.estado === 'CONTROL_CALIDAD').length || 0

  const porEstado: Record<string, number> = {}
  piezas?.forEach(p => { porEstado[p.estado] = (porEstado[p.estado] || 0) + 1 })

  const porSeguro: Record<string, number> = {}
  siniestros?.forEach(s => { porSeguro[s.tipo_seguro] = (porSeguro[s.tipo_seguro] || 0) + 1 })

  const { data: recientes } = await supabase
    .from('siniestros').select('*, piezas(estado)')
    .eq('activo', true).order('created_at', { ascending: false }).limit(8)

  const ESTADOS_FLUJO: PiezaEstado[] = [
    'REGISTRADO','EN_TRASLADO','RECIBIDO','ASIGNADO',
    'EN_REPARACION','EN_PREPARACION','EN_PINTURA','EN_PULIDO',
    'CONTROL_CALIDAD','LISTO_ENTREGA','ENTREGADO'
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Dashboard</h1>
        <p className="text-sm text-[#475569] mt-0.5">Vista general del taller</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total piezas', value: total, icon: Package, color: 'text-[#00D4FF]', bg: 'bg-[#00D4FF]/10' },
          { label: 'En proceso', value: enProceso, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
          { label: 'Control calidad', value: calidad, icon: AlertTriangle, color: 'text-purple-400', bg: 'bg-purple-400/10' },
          { label: 'Listo entrega', value: listos, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-400/10' },
        ].map(kpi => (
          <div key={kpi.label} className="card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#475569]">{kpi.label}</p>
                <p className="text-3xl font-syne font-bold text-white mt-1">{kpi.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon size={20} className={kpi.color} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-syne font-semibold text-white mb-4">Pipeline de piezas</h2>
          <div className="space-y-2">
            {ESTADOS_FLUJO.filter(e => porEstado[e] > 0).map(estado => {
              const count = porEstado[estado] || 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={estado} className="flex items-center gap-3">
                  <div className="w-32 flex-shrink-0">
                    <span className={`badge ${ESTADO_COLOR[estado]} text-xs`}>{ESTADO_LABELS[estado]}</span>
                  </div>
                  <div className="flex-1 bg-[#131920] rounded-full h-2">
                    <div className="h-2 rounded-full bg-[#00D4FF]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-white w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="font-syne font-semibold text-white mb-4">Por seguro</h2>
          <div className="space-y-3">
            {Object.entries(porSeguro).sort((a,b) => b[1]-a[1]).map(([seg, count]) => {
              const pct = siniestros ? Math.round((count/siniestros.length)*100) : 0
              return (
                <div key={seg} className="flex items-center gap-3">
                  <span className="text-sm text-[#94A3B8] w-24 flex-shrink-0">{seg}</span>
                  <div className="flex-1 bg-[#131920] rounded-full h-2">
                    <div className="h-2 rounded-full bg-[#7C3AED]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-white w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-syne font-semibold text-white">Siniestros recientes</h2>
          <Link href="/siniestros" className="text-xs text-[#00D4FF] hover:underline">Ver todos</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E2D42]">
                <th className="text-left text-xs text-[#475569] font-medium pb-2 pr-4">Siniestro</th>
                <th className="text-left text-xs text-[#475569] font-medium pb-2 pr-4">Placa</th>
                <th className="text-left text-xs text-[#475569] font-medium pb-2 pr-4">Taller</th>
                <th className="text-left text-xs text-[#475569] font-medium pb-2 pr-4">Seguro</th>
                <th className="text-left text-xs text-[#475569] font-medium pb-2">Piezas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D42]/50">
              {recientes?.map(s => {
                const tp = s.piezas?.length || 0
                const lp = s.piezas?.filter((p: any) => ['LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length || 0
                return (
                  <tr key={s.id} className="hover:bg-[#131920]/50">
                    <td className="py-2.5 pr-4">
                      <Link href={`/siniestros/${s.id}`} className="text-[#00D4FF] hover:underline font-mono text-xs">{s.numero_siniestro}</Link>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-white">{s.placa}</td>
                    <td className="py-2.5 pr-4 text-[#94A3B8] text-xs truncate max-w-[120px]">{s.taller_origen}</td>
                    <td className="py-2.5 pr-4 text-xs text-[#94A3B8]">{s.tipo_seguro}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#131920] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-green-500" style={{ width: tp > 0 ? `${Math.round((lp/tp)*100)}%` : '0%' }} />
                        </div>
                        <span className="text-xs text-[#475569]">{lp}/{tp}</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
