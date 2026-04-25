import { createClient } from '@/lib/supabase/server'
import { ESTADO_COLOR, ESTADO_LABELS, Profile } from '@/types'
import Link from 'next/link'
import { QrCode, ChevronRight } from 'lucide-react'

export const revalidate = 0

export default async function DashboardTrabajadorInicio({ profile }: { profile: Profile }) {
  const supabase = await createClient()

  const estados = ['ASIGNADO', 'EN_REPARACION', 'EN_PREPARACION', 'EN_PINTURA', 'EN_PULIDO', 'CONTROL_CALIDAD']

  const { data: piezas } = await supabase
    .from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro, placa, tipo_seguro)')
    .in('estado', estados)
    .order('updated_at', { ascending: false })

  const misPiezas = piezas?.filter((p: any) => p.trabajador_reparacion_id === profile.id) || []
  const totalActivas = piezas?.length || 0

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="pt-2 pb-1">
        <h1 className="text-2xl font-syne font-bold text-white">Inicio</h1>
        <p className="text-sm text-[#475569]">Hola {profile.nombre} — {misPiezas.length} piezas tuyas en proceso</p>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-syne font-bold text-amber-400">{misPiezas.length}</p>
          <p className="text-xs text-[#475569] mt-0.5">Mis piezas</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-syne font-bold text-[#00D4FF]">{totalActivas}</p>
          <p className="text-xs text-[#475569] mt-0.5">Total en taller</p>
        </div>
      </div>

      {/* Todas las piezas activas */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider px-1">
          Piezas en proceso — {totalActivas}
        </p>
        {!piezas?.length ? (
          <div className="card p-8 text-center">
            <p className="text-[#475569]">No hay piezas en proceso</p>
          </div>
        ) : (
          piezas.map((p: any) => (
            <Link key={p.id} href={`/scan/${p.id}`}
              className={`card p-3 flex items-center gap-3 active:scale-[0.98] transition-all ${p.trabajador_reparacion_id === profile.id ? 'border-amber-500/30' : 'hover:border-[#00D4FF]/20'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {p.nombre}
                  {p.lado !== 'N/A' && <span className="text-[#475569] font-normal"> — {p.lado}</span>}
                </p>
                <p className="text-xs text-[#475569] truncate">
                  <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                  {' · '}{p.siniestro?.placa}
                </p>
                {p.trabajador_reparacion_nombre && (
                  <p className={`text-xs mt-0.5 ${p.trabajador_reparacion_id === profile.id ? 'text-amber-400 font-semibold' : 'text-[#475569]'}`}>
                    👤 {p.trabajador_reparacion_nombre}
                    {p.trabajador_reparacion_id === profile.id && ' (tú)'}
                  </p>
                )}
              </div>
              <span className={`text-xs badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]} flex-shrink-0`}>
                {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
