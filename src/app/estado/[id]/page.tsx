import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ESTADO_LABELS, ESTADO_COLOR } from '@/types'
import { CheckCircle, Clock, Package, Wrench, Paintbrush, Sparkles, ShieldCheck } from 'lucide-react'

export default async function EstadoPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: siniestro } = await supabase
    .from('siniestros')
    .select(`
      id, numero_siniestro, placa, marca, modelo, anio,
      tipo_seguro, taller_origen, fecha_recojo,
      piezas (
        id, qr_code, nombre, lado, color,
        requiere_reparacion, requiere_pintura, requiere_pulido,
        estado, tipo_trabajo,
        historial_piezas (
          estado_anterior, estado_nuevo, accion, created_at
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!siniestro) notFound()

  const piezas = siniestro.piezas || []
  const total = piezas.length
  const listo = piezas.filter((p: any) => ['LISTO_ENTREGA', 'ENTREGADO'].includes(p.estado)).length
  const entregado = piezas.filter((p: any) => p.estado === 'ENTREGADO').length
  const pct = total > 0 ? Math.round((listo / total) * 100) : 0

  const ICONO_ESTADO: Record<string, any> = {
    REGISTRADO: Package,
    EN_TRASLADO: Package,
    RECIBIDO: Package,
    ASIGNADO: Wrench,
    EN_REPARACION: Wrench,
    EN_PREPARACION: Paintbrush,
    EN_PINTURA: Paintbrush,
    EN_PULIDO: Sparkles,
    CONTROL_CALIDAD: ShieldCheck,
    LISTO_ENTREGA: CheckCircle,
    ENTREGADO: CheckCircle,
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F1F5F9]">
      {/* Header */}
      <div className="border-b border-[#1E2D42] bg-[#0D1117]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00D4FF] to-[#7C3AED] flex items-center justify-center flex-shrink-0">
              <Wrench size={14} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-[#475569]">Estado de reparación</p>
              <p className="font-syne font-bold text-white text-sm">RebiplastPRO</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Info siniestro */}
        <div className="bg-[#0D1117] border border-[#1E2D42]/60 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-[#475569]">N° Siniestro</p>
              <p className="font-mono font-bold text-[#00D4FF] text-lg">{siniestro.numero_siniestro}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#475569]">Seguro</p>
              <p className="text-sm font-semibold text-white">{siniestro.tipo_seguro}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div>
              <p className="text-xs text-[#475569]">Placa</p>
              <p className="font-mono text-sm font-semibold text-white">{siniestro.placa}</p>
            </div>
            <div>
              <p className="text-xs text-[#475569]">Vehículo</p>
              <p className="text-sm text-white">{[siniestro.marca, siniestro.modelo].filter(Boolean).join(' ') || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#475569]">Taller</p>
              <p className="text-xs text-[#94A3B8] truncate">{siniestro.taller_origen}</p>
            </div>
          </div>
        </div>

        {/* Progreso general */}
        <div className="bg-[#0D1117] border border-[#1E2D42]/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Progreso general</p>
            <p className="text-sm text-[#475569]">{listo}/{total} piezas listas</p>
          </div>
          <div className="w-full bg-[#131920] rounded-full h-3">
            <div className="h-3 rounded-full bg-gradient-to-r from-[#00D4FF] to-green-500 transition-all"
              style={{ width: `${pct}%` }} />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-[#475569]">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              {total - listo} en proceso
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              {listo} listas
            </span>
            {entregado > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                {entregado} entregadas
              </span>
            )}
          </div>
        </div>

        {/* Piezas */}
        <div>
          <p className="text-sm font-semibold text-white mb-3">Piezas ({total})</p>
          <div className="space-y-3">
            {piezas.map((pieza: any) => {
              const IconoEstado = ICONO_ESTADO[pieza.estado] || Package
              const historial = (pieza.historial_piezas || []).sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )

              return (
                <div key={pieza.id} className="bg-[#0D1117] border border-[#1E2D42]/60 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{pieza.nombre}</p>
                        {pieza.lado && pieza.lado !== 'N/A' && (
                          <span className="text-xs text-[#475569]">{pieza.lado}</span>
                        )}
                        {pieza.color && (
                          <span className="text-xs text-[#475569]">{pieza.color}</span>
                        )}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {pieza.requiere_reparacion && <span className="text-xs text-amber-400">Reparación</span>}
                        {pieza.requiere_pintura && <span className="text-xs text-pink-400">Pintura</span>}
                        {pieza.requiere_pulido && <span className="text-xs text-rose-400">Pulido</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <IconoEstado size={14} className="text-[#475569]" />
                      <span className={`badge ${ESTADO_COLOR[pieza.estado as keyof typeof ESTADO_COLOR]} text-xs`}>
                        {ESTADO_LABELS[pieza.estado as keyof typeof ESTADO_LABELS]}
                      </span>
                    </div>
                  </div>

                  {/* Historial simplificado */}
                  {historial.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1E2D42]/50 space-y-2">
                      {historial.slice(0, 5).map((h: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] flex-shrink-0" />
                            <span className="text-[#94A3B8]">{h.accion}</span>
                            {h.estado_nuevo && (
                              <span className={`badge ${ESTADO_COLOR[h.estado_nuevo as keyof typeof ESTADO_COLOR]} text-xs`}>
                                {ESTADO_LABELS[h.estado_nuevo as keyof typeof ESTADO_LABELS]}
                              </span>
                            )}
                          </div>
                          <span className="text-[#475569]">
                            {new Date(h.created_at).toLocaleDateString('es-PE', {
                              day: '2-digit', month: '2-digit', year: '2-digit'
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-xs text-[#2D3F55] pb-4">
          RebiplastPRO — Actualizado en tiempo real
        </p>
      </div>
    </div>
  )
}
