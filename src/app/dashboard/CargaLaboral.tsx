'use client'

import { useState } from 'react'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { X, ChevronRight } from 'lucide-react'

interface Pieza {
  id: string
  nombre: string
  lado: string
  estado: string
  requiere_reparacion: boolean
  requiere_pintura: boolean
  requiere_pulido: boolean
  siniestro: { numero_siniestro: string, placa: string }
}

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  carga: number
  piezas?: Pieza[]
}

export default function CargaLaboral({ trabajadores }: { trabajadores: Trabajador[] }) {
  const [seleccionado, setSeleccionado] = useState<Trabajador | null>(null)

  if (!trabajadores || trabajadores.length === 0) {
    return <p className="text-sm text-[#475569] text-center py-4">Sin trabajadores disponibles ({String(trabajadores?.length)})</p>
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {trabajadores.map(t => (
          <button key={t.id} onClick={() => setSeleccionado(t)}
            className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${
              t.carga === 0 ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/60' :
              t.carga <= 2 ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60' :
              'bg-red-500/10 border-red-500/30 hover:border-red-500/60'
            }`}>
            <p className="text-sm font-medium text-white">{t.nombre}</p>
            <p className="text-xs text-[#475569]">{t.apellido}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className={`w-2 h-2 rounded-full ${
                t.carga === 0 ? 'bg-green-400' :
                t.carga <= 2 ? 'bg-amber-400' : 'bg-red-400'
              }`} />
              <span className={`text-xs font-semibold ${
                t.carga === 0 ? 'text-green-400' :
                t.carga <= 2 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {t.carga === 0 ? 'Libre' : `${t.carga} pieza${t.carga > 1 ? 's' : ''}`}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Modal detalle trabajador */}
      {seleccionado && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#1E2D42]">
              <div>
                <p className="font-syne font-bold text-white">{seleccionado.nombre} {seleccionado.apellido}</p>
                <p className={`text-xs font-semibold mt-0.5 ${
                  seleccionado.carga === 0 ? 'text-green-400' :
                  seleccionado.carga <= 2 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {seleccionado.carga === 0 ? 'Sin piezas asignadas' : `${seleccionado.carga} pieza${seleccionado.carga > 1 ? 's' : ''} en proceso`}
                </p>
              </div>
              <button onClick={() => setSeleccionado(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#131920] text-[#475569] hover:text-white">
                <X size={16} />
              </button>
            </div>

            {/* Lista piezas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {!seleccionado.piezas?.length ? (
                <p className="text-sm text-[#475569] text-center py-8">Sin piezas asignadas actualmente</p>
              ) : (
                seleccionado.piezas.map(p => (
                  <Link key={p.id} href={`/scan/${p.id}`}
                    onClick={() => setSeleccionado(null)}
                    className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl hover:bg-[#1A2332] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.nombre}
                        {p.lado !== 'N/A' && <span className="text-[#475569] font-normal"> — {p.lado}</span>}
                      </p>
                      <p className="text-xs text-[#475569] mt-0.5">
                        <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                        {' · '}{p.siniestro?.placa}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                        {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                        {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]} text-xs`}>
                        {ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}
                      </span>
                      <ChevronRight size={14} className="text-[#2D3F55]" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
