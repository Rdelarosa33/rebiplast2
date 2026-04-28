'use client'

import { useState } from 'react'
import AsignarPieza from './AsignarPieza'
import InfoSiniestro from './InfoSiniestro'
import { getTipoTrabajo, getTipoTrabajoDescripcion } from '@/types'

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  carga: number
}

interface SiniestroLite {
  numero_siniestro: string
  numero_orden?: string | null
  placa: string
  tipo_seguro?: string | null
  nombre_girador?: string | null
  taller_origen?: string | null
}

interface Pieza {
  id: string
  nombre: string
  lado: string
  tipo_trabajo?: string
  requiere_reparacion: boolean
  requiere_pintura: boolean
  requiere_pulido: boolean
  es_faro?: boolean
  siniestro: SiniestroLite
}

export default function PorAsignarList({ piezas, trabajadores }: { piezas: Pieza[], trabajadores: Trabajador[] }) {
  const [lista, setLista] = useState(piezas)
  const [cargas, setCargas] = useState<Record<string, number>>(
    Object.fromEntries(trabajadores.map(t => [t.id, t.carga]))
  )

  const handleAsignado = (piezaId: string, trabajadorId: string) => {
    setLista(prev => prev.filter(p => p.id !== piezaId))
    setCargas(prev => ({ ...prev, [trabajadorId]: (prev[trabajadorId] || 0) + 1 }))
  }

  const handleFlagsChange = (piezaId: string, flags: {
    requiere_reparacion: boolean
    requiere_pintura: boolean
    requiere_pulido: boolean
    es_faro: boolean
  }) => {
    const tipo = getTipoTrabajo(flags)
    setLista(prev => prev.map(p =>
      p.id === piezaId
        ? { ...p, ...flags, tipo_trabajo: tipo }
        : p
    ))
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
      {lista.map(p => {
        // Calcular tipo derivado de los flags actuales (por si está desactualizado en BD)
        const tipoCalculado = getTipoTrabajo({
          requiere_reparacion: p.requiere_reparacion,
          requiere_pintura: p.requiere_pintura,
          requiere_pulido: p.requiere_pulido,
          es_faro: p.es_faro ?? false,
        })
        const tipo = p.tipo_trabajo || tipoCalculado

        return (
          <div key={p.id} className="p-3 bg-[#131920] rounded-xl space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                  <span
                    className="text-[10px] font-mono font-bold text-[#00D4FF] bg-[#0D1117] border border-[#1E2D42] px-1.5 py-0.5 rounded"
                    title={getTipoTrabajoDescripcion(tipo)}
                  >
                    {tipo}
                  </span>
                  {p.lado !== 'N/A' && (
                    <span className="text-xs text-[#475569]">{p.lado}</span>
                  )}
                </div>
                <InfoSiniestro siniestro={p.siniestro} variant="compact" />
                <div className="flex gap-1.5 mt-1">
                  {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                  {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                  {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                  {p.es_faro && <span className="text-xs text-cyan-400">Faro</span>}
                </div>
              </div>
            </div>
            <AsignarPieza
              piezaId={p.id}
              trabajadores={trabajadoresConCargaActual}
              flagsIniciales={{
                requiere_reparacion: p.requiere_reparacion,
                requiere_pintura: p.requiere_pintura,
                requiere_pulido: p.requiere_pulido,
                es_faro: p.es_faro ?? false,
              }}
              onAsignado={(_, trabajadorId) => handleAsignado(p.id, trabajadorId)}
              onFlagsChange={flags => handleFlagsChange(p.id, flags)}
            />
          </div>
        )
      })}
    </div>
  )
}
