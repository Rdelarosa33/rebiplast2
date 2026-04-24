'use client'

import { getAcciones, ESTADO_LABELS, UserRole, Pieza } from '@/types'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function PiezaAcciones({ pieza, role }: { pieza: Pieza, role?: UserRole }) {
  if (!role) return null

  const acciones = getAcciones(pieza.estado, role, pieza)
  if (acciones.length === 0) return null

  // Solo mostrar un hint de que hay acciones disponibles — el cambio se hace en /scan/[id]
  return (
    <Link href={`/scan/${pieza.id}`}
      className="mt-2 flex items-center gap-1.5 text-xs text-[#00D4FF] hover:text-white transition-colors">
      <span>{acciones.length} acción{acciones.length > 1 ? 'es' : ''} disponible{acciones.length > 1 ? 's' : ''}</span>
      <ChevronRight size={12} />
    </Link>
  )
}
