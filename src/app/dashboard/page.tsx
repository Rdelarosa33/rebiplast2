import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import DashboardAdmin from './DashboardAdmin'
import DashboardSupervisor from './DashboardSupervisor'
import DashboardTrabajadorInicio from './DashboardTrabajadorInicio'
import DashboardOwner from './DashboardOwner'

export default async function DashboardPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  if (profile.role === 'admin') return <DashboardAdmin />
  if (profile.role === 'supervisor') return <DashboardSupervisor />
  if (profile.role === 'owner') return <DashboardOwner />
  if (profile.role === 'mantenimiento') redirect('/mantenimiento')
  // Recojo y recojo_trabajador: hub directo
  if (profile.role === 'recojo' || profile.role === 'recojo_trabajador') redirect('/recojo')
  // Trabajadores: vista de mis piezas
  return <DashboardTrabajadorInicio profile={profile} />
}
