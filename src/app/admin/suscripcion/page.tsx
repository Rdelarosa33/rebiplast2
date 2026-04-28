import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import { Calendar } from 'lucide-react'
import DesgloseSuscripcion from './DesgloseSuscripcion'

export const revalidate = 0

export default async function SuscripcionPage() {
  const profile = await getCurrentUser()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) redirect('/dashboard')

  const supabase = await createClient()
  const { data: sus } = await supabase.from('suscripcion').select('*').single()

  const vencimiento = sus ? new Date(sus.fecha_vencimiento) : null
  const hoy = new Date()
  const diasRestantes = vencimiento ? Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : 0

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Suscripción</h1>
        <p className="text-sm text-[#475569] mt-0.5">Información del plan contratado</p>
      </div>

      {/* Suscripción */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Plan Profesional</h2>
          <span className={`ml-auto text-xs badge ${sus?.activa && diasRestantes > 0 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
            {sus?.activa && diasRestantes > 0 ? 'Activo' : 'Vencido'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-[#131920] rounded-xl p-3">
            <p className="text-xs text-[#475569]">Precio mensual</p>
            <p className="text-xl font-syne font-bold text-white">${sus?.precio_mensual || 300}</p>
          </div>
          <div className="bg-[#131920] rounded-xl p-3">
            <p className="text-xs text-[#475569]">Vence el</p>
            <p className="text-sm font-semibold text-white">
              {vencimiento ? vencimiento.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : '--'}
            </p>
            {diasRestantes > 0 && <p className="text-xs text-green-400">{diasRestantes} días restantes</p>}
            {diasRestantes <= 0 && <p className="text-xs text-red-400">Vencida hace {Math.abs(diasRestantes)} días</p>}
          </div>
        </div>
        <DesgloseSuscripcion precio={sus?.precio_mensual || 300} />
      </div>
    </div>
  )
}
