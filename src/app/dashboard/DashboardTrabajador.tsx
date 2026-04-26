import { createClient } from '@/lib/supabase/server'
import { ESTADO_COLOR, ESTADO_LABELS, Profile } from '@/types'
import Link from 'next/link'
import { Hammer, QrCode, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react'

export const revalidate = 0

export default async function DashboardTrabajador({ profile }: { profile: Profile }) {
  const supabase = await createClient()

  const estados = ['ASIGNADO', 'EN_REPARACION', 'EN_PREPARACION', 'EN_PINTURA', 'EN_PULIDO']

  const { data: piezas } = await supabase
    .from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro, placa, tipo_seguro), historial:historial_piezas(accion, estado_nuevo, motivo, usuario_nombre, created_at)')
    .in('estado', estados)
    .eq('trabajador_reparacion_id', profile.id)
    .order('updated_at', { ascending: false })

  const piezasConInfo = piezas?.map((p: any) => {
    const rechazos = p.historial?.filter((h: any) => h.estado_nuevo === 'ASIGNADO' && h.motivo && h.usuario_nombre) || []
    const rechazo = rechazos.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    return { ...p, devuelta: !!rechazo, motivo_devolucion: rechazo?.motivo, supervisor_devolucion: rechazo?.usuario_nombre }
  }) || []

  const devueltas = piezasConInfo.filter(p => p.devuelta)

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center pt-2 pb-1">
        <h1 className="text-2xl font-syne font-bold text-amber-400">Mis Piezas</h1>
        <p className="text-sm text-[#475569]">{profile.nombre} — {piezasConInfo.length} piezas pendientes</p>
      </div>

      {/* Alerta devueltas */}
      {devueltas.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <p className="text-sm font-semibold text-red-400">{devueltas.length} pieza{devueltas.length > 1 ? 's' : ''} devuelta{devueltas.length > 1 ? 's' : ''}</p>
          </div>
          {devueltas.map((p: any) => (
            <Link key={p.id} href={`/scan/${p.id}`} className="block text-xs text-[#94A3B8] hover:text-white py-0.5">
              • {p.nombre} — "{p.motivo_devolucion}"
            </Link>
          ))}
        </div>
      )}

      {/* Scanner rápido */}
      <Link href="/scan"
        className="flex items-center justify-between p-4 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00D4FF]/20 flex items-center justify-center">
            <QrCode size={20} className="text-[#00D4FF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Escanear QR</p>
            <p className="text-xs text-[#475569]">Buscar pieza por código</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-[#00D4FF]" />
      </Link>

      {/* Lista de piezas */}
      {!piezasConInfo.length ? (
        <div className="card p-16 text-center">
          <CheckCircle size={40} className="text-green-400 mx-auto mb-4" />
          <p className="text-white font-medium">Sin piezas pendientes</p>
          <p className="text-xs text-[#2D3F55] mt-1">El supervisor te asignará piezas pronto</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider px-1">Piezas asignadas</p>
          {piezasConInfo.map((p: any) => (
            <Link key={p.id} href={`/scan/${p.id}`}
              className={`card p-4 flex items-center gap-3 active:scale-[0.98] transition-all ${p.devuelta ? 'border-red-500/30 bg-red-500/5' : 'hover:border-[#00D4FF]/30'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.devuelta ? 'bg-red-500/20' : 'bg-[#131920]'}`}>
                {p.devuelta
                  ? <AlertTriangle size={18} className="text-red-400" />
                  : <Hammer size={18} className="text-amber-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {p.nombre}
                  {p.lado !== 'N/A' && <span className="text-[#475569] font-normal"> — {p.lado}</span>}
                </p>
                <p className="text-xs text-[#475569] mt-0.5 truncate">
                  <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                  {' · '}{p.siniestro?.placa}
                </p>
                {p.devuelta ? (
                  <p className="text-xs text-red-400 mt-0.5 truncate">⚠ {p.motivo_devolucion}</p>
                ) : (
                  <div className="flex gap-2 mt-1">
                    {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                    {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                    {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {p.devuelta ? (
                  <span className="text-xs badge bg-red-500/20 text-red-300 border-red-500/30">Devuelta</span>
                ) : (
                  <span className={`text-xs badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]}`}>
                    {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}
                  </span>
                )}
                <ChevronRight size={14} className="text-[#2D3F55]" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
