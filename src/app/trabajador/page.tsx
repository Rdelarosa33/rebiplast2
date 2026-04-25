import { getCurrentUser } from '@/lib/actions'
import DashboardTrabajador from '../dashboard/DashboardTrabajador'
import { redirect } from 'next/navigation'

export default async function TrabajadorPage() {
  const profile = await getCurrentUser()
  if (!profile) redirect('/login')
  return <DashboardTrabajador profile={profile} />
}
