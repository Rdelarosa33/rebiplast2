import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { Plus, ClipboardList, Package } from 'lucide-react'

export default async function DashboardRecojo() {
  const supabase = await createClient()
  const profile = await getCurrentUser()

  const { data: siniestros } = await supabase
    .from('siniestros')
    .select('*, piezas(id, estado)')
    .eq('responsable_recojo_id', profile?.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const pendientes = siniestros?.filter(s =>
    s.piezas?.some((p: any) => p.estado === 'REGISTRADO')
  ) || []

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-syne font-bold text-white">Mis Recojos</h1>
          <p className="text-sm text-[#475569] mt-0.5">{profile?.nombre}</p>
        </div>
        <Link href="/siniestros/nuevo" className="btn-primary">
          <Plus size={16} /> Nuevo recojo
        </Link>
      </div>

      {pendientes.length > 0 && (
        <div className="card p-4 border-amber-500/30 bg-amber-500/5">
          <p className="text-xs font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Package size={14} /> {pendientes.length} siniestro{pendientes.length > 1 ? 's' : ''} pendiente{pendientes.length > 1 ? 's' : ''} de traslado
          </p>
          <div className="space-y-2">
            {pendientes.map((s: any) => (
              <Link key={s.id} href={`/siniestros/${s.id}`}
                className="flex items-center justify-between p-2 bg-[#131920] rounded-xl hover:bg-[#1A2332] transition-colors">
                <div>
                  <span className="font-mono text-xs text-[#00D4FF]">{s.numero_siniestro}</span>
                  <span className="text-xs text-[#475569] ml-2">{s.placa}</span>
                </div>
                <span className="text-xs text-amber-400">Marcar traslado →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Mis siniestros recientes</h2>
        </div>
        {!siniestros?.length ? (
          <p className="text-sm text-[#475569] text-center py-6">No has registrado siniestros aún</p>
        ) : (
          <div className="space-y-2">
            {siniestros.map((s: any) => {
              const total = s.piezas?.length || 0
              const listo = s.piezas?.filter((p: any) => ['LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length || 0
              return (
                <Link key={s.id} href={`/siniestros/${s.id}`}
                  className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl hover:bg-[#1A2332] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[#00D4FF]">{s.numero_siniestro}</p>
                    <p className="text-xs text-[#475569]">{s.placa} · {s.taller_origen}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-[#0D1117] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-green-500" style={{ width: total > 0 ? `${Math.round((listo/total)*100)}%` : '0%' }} />
                    </div>
                    <span className="text-xs text-[#475569]">{listo}/{total}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
