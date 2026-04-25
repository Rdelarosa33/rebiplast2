'use client'

import { useState } from 'react'
import { cambiarEstadoPieza } from '@/lib/actions'
import { UserCheck, ChevronDown } from 'lucide-react'

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  carga: number
}

export default function AsignarPieza({ piezaId, trabajadores }: { piezaId: string, trabajadores: Trabajador[] }) {
  const [seleccionado, setSeleccionado] = useState('')
  const [loading, setLoading] = useState(false)
  const [asignado, setAsignado] = useState(false)

  const asignar = async () => {
    if (!seleccionado) return
    setLoading(true)
    const trab = trabajadores.find(t => t.id === seleccionado)
    const result = await cambiarEstadoPieza(
      piezaId,
      'ASIGNADO',
      `Asignado a ${trab?.nombre} ${trab?.apellido}`,
      undefined,
      seleccionado,
      `${trab?.nombre} ${trab?.apellido}`
    )
    if (!result.error) setAsignado(true)
    setLoading(false)
  }

  if (asignado) return (
    <div className="flex items-center gap-2 text-xs text-green-400">
      <UserCheck size={12} />
      Asignado correctamente
    </div>
  )

  return (
    <div className="flex gap-2 items-center">
      <div className="relative flex-1">
        <select
          value={seleccionado}
          onChange={e => setSeleccionado(e.target.value)}
          className="w-full text-xs bg-[#0D1117] border border-[#1E2D42] text-[#94A3B8] rounded-lg px-3 py-1.5 pr-7 appearance-none focus:border-[#00D4FF] focus:outline-none"
        >
          <option value="">Asignar a...</option>
          {trabajadores.map(t => (
            <option key={t.id} value={t.id}>
              {t.nombre} {t.apellido} — {t.carga === 0 ? '✓ Libre' : `${t.carga} piezas`}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
      </div>
      <button
        onClick={asignar}
        disabled={!seleccionado || loading}
        className="text-xs bg-[#00D4FF] text-[#080B12] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 flex-shrink-0"
      >
        {loading ? '...' : 'Asignar'}
      </button>
    </div>
  )
}
