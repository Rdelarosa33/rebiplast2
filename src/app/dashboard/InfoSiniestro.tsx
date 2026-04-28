import { Shield, FileText, User, Building2, Hash } from 'lucide-react'

interface SiniestroInfo {
  numero_siniestro?: string | null
  numero_orden?: string | null
  tipo_seguro?: string | null
  nombre_girador?: string | null
  taller_origen?: string | null
}

/**
 * Muestra la información obligatoria del siniestro:
 * Seguro · # Siniestro · Girador · Taller · # Orden
 *
 * Variantes:
 *  - 'card':    bloque vertical etiquetado (uso: detalles, scan)
 *  - 'inline':  fila compacta horizontal (uso: listas, dashboards)
 *  - 'compact': badges simples una línea (uso: tarjetas pequeñas)
 */
export default function InfoSiniestro({
  siniestro,
  variant = 'card',
}: {
  siniestro: SiniestroInfo | null | undefined
  variant?: 'card' | 'inline' | 'compact'
}) {
  if (!siniestro) return null

  const seguro = siniestro.tipo_seguro || '—'
  const numSin = siniestro.numero_siniestro || '—'
  const numOrd = siniestro.numero_orden || '—'
  const girador = siniestro.nombre_girador || '—'
  const taller = siniestro.taller_origen || '—'

  if (variant === 'card') {
    return (
      <div className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <Item icon={<Shield size={12} />} label="Seguro" value={seguro} />
        <Item icon={<Hash size={12} />} label="N° Siniestro" value={numSin} mono />
        <Item icon={<FileText size={12} />} label="N° Orden" value={numOrd} mono />
        <Item icon={<User size={12} />} label="Girador" value={girador} />
        <Item icon={<Building2 size={12} />} label="Taller" value={taller} className="sm:col-span-2" />
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#94A3B8]">
        <span className="inline-flex items-center gap-1"><Shield size={11} className="text-[#475569]" /> {seguro}</span>
        <span className="text-[#1E2D42]">·</span>
        <span className="inline-flex items-center gap-1 font-mono text-[#00D4FF]"><Hash size={11} className="text-[#475569]" /> {numSin}</span>
        <span className="text-[#1E2D42]">·</span>
        <span className="inline-flex items-center gap-1 font-mono"><FileText size={11} className="text-[#475569]" /> {numOrd}</span>
        <span className="text-[#1E2D42]">·</span>
        <span className="inline-flex items-center gap-1"><User size={11} className="text-[#475569]" /> {girador}</span>
        <span className="text-[#1E2D42]">·</span>
        <span className="inline-flex items-center gap-1"><Building2 size={11} className="text-[#475569]" /> {taller}</span>
      </div>
    )
  }

  // compact (1 línea, lo más resumido posible)
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#94A3B8]">
      <span>{seguro}</span>
      <span className="text-[#1E2D42]">·</span>
      <span className="font-mono text-[#00D4FF]">{numSin}</span>
      <span className="text-[#1E2D42]">·</span>
      <span className="font-mono text-[#475569]">{numOrd}</span>
      <span className="text-[#1E2D42]">·</span>
      <span>{girador}</span>
      <span className="text-[#1E2D42]">·</span>
      <span className="text-[#94A3B8]">{taller}</span>
    </div>
  )
}

function Item({
  icon,
  label,
  value,
  mono,
  className = '',
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <span className="text-[#475569] mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-[#475569]">{label}</p>
        <p className={`text-white truncate ${mono ? 'font-mono text-[#00D4FF]' : ''}`}>{value}</p>
      </div>
    </div>
  )
}
