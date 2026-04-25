import { createClient } from '@/lib/supabase/server'
import { ESTADO_COLOR, ESTADO_LABELS, Profile } from '@/types'
import Link from 'next/link'
import { Hammer, QrCode, ChevronRight } from 'lucide-react'

export default async function DashboardTrabajador({ profile }: { profile: Profile }) {
  const supabase = await createClient()

  // Trabajador polivalente — ve todas las etapas de trabajo
  const estados = ['ASIGNADO', 'EN_REPARACION', 'EN_PREPARACION', 'EN_PINTURA', 'EN_PULIDO']

  const { data: piezas } = await supabase
    .from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro, placa, taller_origen, tipo_seguro), historial:historial_piezas(accion, estado_nuevo, motivo, created_at, usuario_nombre)')
    .in('estado', estados)
    .eq('trabajador_reparacion_id', profile.id)
    .order('updated_at', { ascending: false })

  // Detectar piezas devueltas — tienen historial de CONTROL_CALIDAD previo
  const piezasConDevolucion = piezas?.map((p: any) => {
    const rechazo = p.historial?.find((h: any) => 
      h.estado_nuevo === 'ASIGNADO' && h.motivo && h.usuario_nombre
    )
    return { ...p, devuelta: !!rechazo, motivo_devolucion: rechazo?.motivo, supervisor_devolucion: rechazo?.usuario_nombre }
  })

  const rolLabel: Record<string, string> = {
    trabajador: 'Mis Piezas',
    recojo_trabajador: 'Mis Piezas',
  }

  const rolColor: Record<string, string> = {
    trabajador: 'text-amber-400',
    recojo_trabajador: 'text-teal-400',
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center pt-2 pb-1">
        <h1 className={`text-2xl font-syne font-bold ${rolColor[profile.role] || 'text-white'}`}>
          {rolLabel[profile.role]}
        </h1>
        <p className="text-sm text-[#475569]">{profile.nombre} — {piezasConDevolucion?.length || 0} piezas pendientes</p>
      </div>

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
      {!piezasConDevolucion?.length ? (
        <div className="card p-16 text-center">
          <Hammer size={40} className="text-[#1E2D42] mx-auto mb-4" />
          <p className="text-[#475569] font-medium">Sin piezas pendientes</p>
          <p className="text-xs text-[#2D3F55] mt-1">El supervisor te asignará piezas pronto</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider px-1">
            Piezas asignadas
          </p>
          {piezasConDevolucion?.map((p: any) => (
            <Link key={p.id} href={`/scan/${p.id}`}
              className="card p-4 flex items-center gap-3 hover:border-[#00D4FF]/30 active:scale-[0.98] transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#131920] flex items-center justify-center flex-shrink-0">
                <Hammer size={18} className={rolColor[profile.role] || 'text-white'} />
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
                <div className="flex gap-2 mt-1 items-center">
                  {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                  {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                  {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                  {p.devuelta ? (
                    <span className="text-xs badge bg-red-500/20 text-red-300 border-red-500/30 ml-auto">⚠ Devuelta</span>
                  ) : (
                    <span className={`text-xs badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]} ml-auto`}>
                      {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}
                    </span>
                  )}
                </div>
                {p.devuelta && (
                  <p className="text-xs text-red-400 mt-1 truncate">"{p.motivo_devolucion}"</p>
                )}
              </div>
              <ChevronRight size={16} className="text-[#2D3F55] flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
