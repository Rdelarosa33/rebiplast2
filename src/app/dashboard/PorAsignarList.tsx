'use client'

import { useState } from 'react'
import Link from 'next/link'
import AsignarPieza from './AsignarPieza'

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  carga: number
}

interface Pieza {
  id: string
  nombre: string
  lado: string
  requiere_reparacion: boolean
  requiere_pintura: boolean
  requiere_pulido: boolean
  siniestro: { numero_siniestro: string, placa: string }
}

export default function PorAsignarList({ piezas, trabajadores }: { piezas: Pieza[], trabajadores: Trabajador[] }) {
  const [lista, setLista] = useState(piezas)
  const [cargas, setCargas] = useState<Record<string, number>>(
    Object.fromEntries(trabajadores.map(t => [t.id, t.carga]))
  )

  const handleAsignado = (piezaId: string, trabajadorId: string) => {
    // Quitar pieza de la lista
    setLista(prev => prev.filter(p => p.id !== piezaId))
    // Actualizar carga del trabajador
    setCargas(prev => ({ ...prev, [trabajadorId]: (prev[trabajadorId] || 0) + 1 }))
  }

  const trabajadoresConCargaActual = trabajadores.map(t => ({
    ...t,
    carga: cargas[t.id] ?? t.carga
  })).sort((a, b) => a.carga - b.carga)

  if (!lista.length) return (
    <p className="text-sm text-[#475569] text-center py-4">✓ Todas las piezas asignadas</p>
  )

  return (
    <div className="space-y-3">
      {lista.map(p => (
        <div key={p.id} className="p-3 bg-[#131920] rounded-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
              <p className="text-xs text-[#475569]">
                {p.lado !== 'N/A' ? `${p.lado} · ` : ''}
                <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                {' · '}{p.siniestro?.placa}
              </p>
              <div className="flex gap-1 mt-1">
                {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
              </div>
            </div>
          </div>
          <AsignarPieza
            piezaId={p.id}
            trabajadores={trabajadoresConCargaActual}
            onAsignado={(_, trabajadorId) => handleAsignado(p.id, trabajadorId)}
          />
        </div>
      ))}
    </div>
  )
}
