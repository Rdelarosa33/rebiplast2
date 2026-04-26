import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import DashboardAdmin from './DashboardAdmin'
import DashboardSupervisor from './DashboardSupervisor'
import DashboardTrabajador from './DashboardTrabajador'
import DashboardTrabajadorInicio from './DashboardTrabajadorInicio'
import DashboardOwner from './DashboardOwner'
import DashboardRecojo from './DashboardRecojo'

export default async function DashboardPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')

  if (profile.role === 'admin') return <DashboardAdmin />
  if (profile.role === 'supervisor') return <DashboardSupervisor />
  if (profile.role === 'recojo') return <DashboardRecojo />
  if (profile.role === 'owner') return <DashboardOwner />
  return <DashboardTrabajadorInicio profile={profile} />
}
