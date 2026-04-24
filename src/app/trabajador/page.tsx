import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { ESTADO_LABELS, ESTADO_COLOR } from '@/types'
import Link from 'next/link'
import { Hammer, QrCode } from 'lucide-react'

export default async function TrabajadorPage() {
  const profile = await getCurrentUser()
  if (!profile) return <p className="text-[#475569]">No autenticado</p>

  const supabase = await createClient()

  // Buscar piezas asignadas según el rol
  let query = supabase.from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen,tipo_seguro)')
    .order('updated_at', { ascending: false })

  if (profile.role === 'reparacion') {
    query = query.eq('trabajador_reparacion_id', profile.id)
      .in('estado', ['ASIGNADO', 'EN_REPARACION'])
  } else if (profile.role === 'preparacion') {
    query = query.eq('trabajador_preparacion_id', profile.id)
      .in('estado', ['EN_PREPARACION'])
  } else if (profile.role === 'pintura') {
    query = query.eq('trabajador_pintura_id', profile.id)
      .in('estado', ['EN_PINTURA', 'EN_PULIDO'])
  }

  const { data: piezas } = await query

  // También piezas en estado que corresponde al rol aunque no estén asignadas específicamente
  const { data: piezasEstado } = await supabase.from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro,placa,taller_origen,tipo_seguro)')
    .in('estado', profile.role === 'reparacion' ? ['ASIGNADO','EN_REPARACION'] :
        profile.role === 'preparacion' ? ['EN_PREPARACION'] : ['EN_PINTURA','EN_PULIDO'])
    .order('updated_at', { ascending: false })
    .limit(20)

  // Combinar y deduplicar
  const todas = [...(piezas || []), ...(piezasEstado || [])]
  const unicas = Array.from(new Map(todas.map(p => [p.id, p])).values())

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Mis Piezas</h1>
        <p className="text-sm text-[#475569] mt-0.5">
          {profile.nombre} — {unicas.length} piezas en tu etapa
        </p>
      </div>

      {unicas.length === 0 ? (
        <div className="card p-12 text-center">
          <Hammer size={32} className="text-[#1E2D42] mx-auto mb-3" />
          <p className="text-[#475569]">No tienes piezas asignadas en este momento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {unicas.map((p: any) => (
            <Link key={p.id} href={`/scan/${p.id}`}
              className="card p-4 flex items-center gap-4 hover:border-[#00D4FF]/30 transition-colors">
              <QrCode size={18} className="text-[#475569] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{p.nombre}
                  {p.lado !== 'N/A' && <span className="text-[#475569] font-normal"> — {p.lado}</span>}
                </p>
                <p className="text-xs text-[#475569] mt-0.5">
                  <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                  {' · '}{p.siniestro?.placa}{' · '}{p.siniestro?.taller_origen}
                </p>
                <div className="flex gap-2 mt-1">
                  {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                  {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                  {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                  {p.precio && <span className="text-xs text-[#475569]">S/ {p.precio}</span>}
                </div>
              </div>
              <span className={`badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]} flex-shrink-0`}>
                {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="card p-4">
        <p className="text-xs text-[#475569] text-center">
          Toca una pieza para ver el detalle y marcarla como terminada.
          También puedes buscarla escaneando su QR.
        </p>
      </div>
    </div>
  )
}
