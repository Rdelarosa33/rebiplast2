'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarEstadoPieza } from '@/lib/actions'
import { UserRole, Pieza, ESTADO_LABELS } from '@/types'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function PiezaAcciones({ pieza, role }: { pieza: Pieza, role?: UserRole }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [modal, setModal] = useState<{ label: string, estado: string } | null>(null)

  if (!role || role === 'trabajador' || role === 'recojo_trabajador' || role === 'recojo') {
    // Trabajadores y recojo solo ven link al scan
    return (
      <Link href={`/scan/${pieza.id}`}
        className="mt-2 flex items-center gap-1.5 text-xs text-[#00D4FF] hover:text-white transition-colors">
        <span>Ver detalle y acciones</span>
        <ChevronRight size={12} />
      </Link>
    )
  }

  const ejecutar = async (estadoNuevo: string, motivoText?: string) => {
    setLoading(true)
    await cambiarEstadoPieza(pieza.id, estadoNuevo as any, modal?.label || '', motivoText)
    setLoading(false)
    setModal(null)
    setMotivo('')
    setTimeout(() => router.refresh(), 300)
  }

  // SUPERVISOR / ADMIN — solo acciones de gestión
  return (
    <div className="mt-2 space-y-2">
      {/* Control de calidad */}
      {pieza.estado === 'CONTROL_CALIDAD' && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => ejecutar('LISTO_ENTREGA')} disabled={loading}
            className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50">
            ✓ Aprobar
          </button>
          {pieza.requiere_pulido && (
            <button onClick={() => setModal({ label: 'Rechazar — problema en pulido', estado: 'EN_PULIDO' })}
              className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors">
              ✗ Problema pulido
            </button>
          )}
          {pieza.requiere_pintura && (
            <button onClick={() => setModal({ label: 'Rechazar — problema en pintura', estado: 'EN_PINTURA' })}
              className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors">
              ✗ Problema pintura
            </button>
          )}
          <button onClick={() => setModal({ label: 'Rechazar — problema en reparación', estado: 'ASIGNADO' })}
            className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors">
            ✗ Problema reparación
          </button>
        </div>
      )}

      {/* Link a scan para otras acciones */}
      {pieza.estado !== 'CONTROL_CALIDAD' && pieza.estado !== 'LISTO_ENTREGA' && pieza.estado !== 'ENTREGADO' && (
        <Link href={`/scan/${pieza.id}`}
          className="flex items-center gap-1.5 text-xs text-[#475569] hover:text-white transition-colors">
          <span>Ver historial</span>
          <ChevronRight size={12} />
        </Link>
      )}

      {/* Modal motivo rechazo */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="card p-5 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <h3 className="font-syne font-semibold text-white">{modal.label}</h3>
            </div>
            <div>
              <label className="label">Motivo del rechazo *</label>
              <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
                className="input-field" rows={3} placeholder="Describe el problema..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setMotivo('') }} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={() => ejecutar(modal.estado, motivo)} disabled={!motivo || loading}
                className="btn-danger flex-1 justify-center disabled:opacity-50">
                {loading ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
