'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarEstadoPieza } from '@/lib/actions'
import { getAcciones, ESTADO_LABELS, UserRole, Pieza } from '@/types'
import { Loader2 } from 'lucide-react'

export default function PiezaAcciones({ pieza, role }: { pieza: Pieza, role?: UserRole }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  if (!role) return null

  const acciones = getAcciones(pieza.estado, role, pieza)
  // En esta vista solo mostramos la acción principal (la primera)
  const accionPrincipal = acciones.find(a => !a.requiere_motivo)
  if (!accionPrincipal) return null

  const ejecutar = async () => {
    setLoading(true)
    const result = await cambiarEstadoPieza(pieza.id, accionPrincipal.estado_nuevo, accionPrincipal.label)
    if (result.success) {
      setSuccess(`→ ${ESTADO_LABELS[accionPrincipal.estado_nuevo]}`)
      router.refresh()
    }
    setLoading(false)
  }

  if (success) return (
    <p className="text-xs text-green-400 mt-2">{success}</p>
  )

  return (
    <div className="mt-2">
      <button onClick={ejecutar} disabled={loading}
        className="flex items-center gap-1.5 text-xs bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] hover:border-[#00D4FF]/30 text-[#94A3B8] hover:text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
        {loading
          ? <Loader2 size={12} className="animate-spin" />
          : null}
        {accionPrincipal.label}
      </button>
    </div>
  )
}
