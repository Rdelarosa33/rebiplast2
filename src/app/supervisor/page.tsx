import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import DashboardSupervisor from '../dashboard/DashboardSupervisor'

export default async function SupervisorPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin' && profile.role !== 'supervisor') redirect('/dashboard')
  return <DashboardSupervisor />
}
