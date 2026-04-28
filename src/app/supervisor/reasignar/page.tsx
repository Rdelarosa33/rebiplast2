import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import ReasignarSupervisorClient from './ReasignarSupervisorClient'

export const revalidate = 0

export default async function SupervisorReasignarPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')
  if (!['admin', 'supervisor'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  // Traer trabajadores activos
  const { data: trabajadores } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, role, activo')
    .in('role', ['trabajador', 'recojo_trabajador'])
    .eq('activo', true)
    .order('nombre')

  // Para cada trabajador, contar sus piezas activas
  // Una pieza está "activa" para un trabajador si está en alguno de los 3 campos
  // y el estado NO es ENTREGADO ni DEVUELTO
  const trabajadoresConCarga = await Promise.all(
    (trabajadores || []).map(async (t: any) => {
      const { data: piezas } = await supabase
        .from('piezas')
        .select('id, estado')
        .or(
          `trabajador_reparacion_id.eq.${t.id},trabajador_preparacion_id.eq.${t.id},trabajador_pintura_id.eq.${t.id}`
        )
        .not('estado', 'in', '(ENTREGADO,DEVUELTO)')

      return {
        ...t,
        cantidad_piezas: piezas?.length || 0,
      }
    })
  )

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white flex items-center gap-2">
          <RefreshCw size={22} className="text-[#00D4FF]" />
          Reasignar piezas
        </h1>
        <p className="text-sm text-[#475569] mt-0.5">
          Pasa todas las piezas activas de un trabajador a otro (cuando alguien falta)
        </p>
      </div>

      <ReasignarSupervisorClient trabajadores={trabajadoresConCarga} />
    </div>
  )
}
