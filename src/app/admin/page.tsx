import { createClient } from '@/lib/supabase/server'
import { ROLE_LABELS, ROLE_COLOR } from '@/types'
import { Users } from 'lucide-react'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: profiles } = await supabase.from('profiles').select('*').order('role').order('nombre')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Administración</h1>
        <p className="text-sm text-[#475569] mt-0.5">Gestión de usuarios y roles</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Usuarios del sistema</h2>
          <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full ml-auto">
            {profiles?.length || 0}
          </span>
        </div>
        <div className="space-y-2">
          {profiles?.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
              <div className="w-9 h-9 rounded-full bg-[#1A2332] flex items-center justify-center text-xs font-bold text-[#00D4FF] flex-shrink-0">
                {p.nombre[0]}{p.apellido?.[0] || ''}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{p.nombre} {p.apellido}</p>
                <p className="text-xs text-[#475569]">{p.email}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-lg ${ROLE_COLOR[p.role as keyof typeof ROLE_COLOR]}`}>
                {ROLE_LABELS[p.role as keyof typeof ROLE_LABELS]}
              </span>
              <div className={`w-2 h-2 rounded-full ${p.activo ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 text-sm text-[#475569]">
        <p className="font-medium text-white mb-2">Para cambiar el rol de un usuario:</p>
        <p>Ve a Supabase → Table Editor → profiles → edita el campo <code className="text-[#00D4FF]">role</code> del usuario.</p>
      </div>
    </div>
  )
}
