'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import ReasignarPiezaModal from '@/app/dashboard/ReasignarPiezaModal'
import { useRouter } from 'next/navigation'

export default function TrabajadoresAsignados({
  pieza,
  puedeReasignar,
}: {
  pieza: any
  puedeReasignar: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState<{
    campo: 'reparacion' | 'preparacion' | 'pintura'
    actualId: string | null
    actualNombre: string | null
    etiqueta: string
  } | null>(null)

  const campos = [
    {
      key: 'reparacion' as const,
      etiqueta: 'Reparación',
      id: pieza.trabajador_reparacion_id,
      nombre: pieza.trabajador_reparacion_nombre,
      visible: pieza.requiere_reparacion,
      color: 'text-amber-400',
    },
    {
      key: 'preparacion' as const,
      etiqueta: 'Preparación',
      id: pieza.trabajador_preparacion_id,
      nombre: pieza.trabajador_preparacion_nombre,
      visible: pieza.requiere_pulido || pieza.requiere_pintura,
      color: 'text-rose-400',
    },
    {
      key: 'pintura' as const,
      etiqueta: 'Pintura',
      id: pieza.trabajador_pintura_id,
      nombre: pieza.trabajador_pintura_nombre,
      visible: pieza.requiere_pintura,
      color: 'text-pink-400',
    },
  ].filter(c => c.visible && (c.id || c.nombre))  // Solo mostrar si está asignado

  if (campos.length === 0) return null

  // Estados donde no se puede reasignar
  const bloqueado = pieza.estado === 'ENTREGADO' || pieza.estado === 'DEVUELTO'

  return (
    <>
      <div className="mt-2 space-y-1">
        {campos.map(c => (
          <div key={c.key} className="flex items-center gap-2">
            <span className={`text-xs ${c.color}`}>👤 {c.etiqueta}: {c.nombre || '(sin nombre)'}</span>
            {puedeReasignar && !bloqueado && (
              <button
                onClick={() =>
                  setModal({
                    campo: c.key,
                    actualId: c.id,
                    actualNombre: c.nombre,
                    etiqueta: c.etiqueta,
                  })
                }
                className="text-[10px] bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF]/50 rounded px-2 py-0.5 flex items-center gap-1"
                title="Reasignar a otro trabajador"
              >
                <RefreshCw size={10} />
                Reasignar
              </button>
            )}
          </div>
        ))}
      </div>

      {modal && (
        <ReasignarPiezaModal
          piezaId={pieza.id}
          campo={modal.campo}
          trabajadorActualId={modal.actualId}
          trabajadorActualNombre={modal.actualNombre}
          etiquetaCampo={modal.etiqueta}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
