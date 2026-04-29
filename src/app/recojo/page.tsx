import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Truck, PackageOpen, RotateCcw, ScanLine, ChevronRight } from 'lucide-react'

export default async function RecojoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['recojo', 'recojo_trabajador', 'admin', 'mantenimiento'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Contadores en paralelo
  const [registrados, listoEntrega] = await Promise.all([
    supabase.from('piezas').select('id', { count: 'exact', head: true }).eq('estado', 'REGISTRADO'),
    supabase.from('piezas').select('id', { count: 'exact', head: true }).eq('estado', 'LISTO_ENTREGA'),
  ])

  const cantidadPorRecojer = registrados.count || 0
  const cantidadPorEntregar = listoEntrega.count || 0

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Recojo</h1>
        <p className="text-sm text-[#94A3B8]">Gestión de piezas: traer del taller, entregar al cliente, reingresos</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Escanear nueva orden */}
        <Link href="/siniestros/nuevo" className="bg-gradient-to-br from-[#00D4FF]/20 to-[#0080FF]/10 border border-[#00D4FF]/50 rounded-xl p-4 hover:border-[#00D4FF] transition-colors group">
          <div className="flex items-start justify-between">
            <div>
              <ScanLine className="text-[#00D4FF] mb-2" size={24} />
              <h3 className="text-white font-bold">Escanear nueva orden</h3>
              <p className="text-xs text-[#94A3B8] mt-1">Registrar siniestro nuevo desde la orden del taller</p>
            </div>
            <ChevronRight className="text-[#475569] group-hover:text-[#00D4FF]" size={18} />
          </div>
        </Link>

        {/* Recoger del taller */}
        <Link href="/recojo/recoger" className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-4 hover:border-[#00D4FF]/50 transition-colors group">
          <div className="flex items-start justify-between">
            <div>
              <Truck className="text-amber-400 mb-2" size={24} />
              <h3 className="text-white font-bold flex items-center gap-2">
                Recoger del taller
                {cantidadPorRecojer > 0 && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    {cantidadPorRecojer}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">Piezas pendientes de traer del taller a Base</p>
            </div>
            <ChevronRight className="text-[#475569] group-hover:text-[#00D4FF]" size={18} />
          </div>
        </Link>

        {/* Entregar al taller */}
        <Link href="/recojo/entregar" className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-4 hover:border-[#00D4FF]/50 transition-colors group">
          <div className="flex items-start justify-between">
            <div>
              <PackageOpen className="text-green-400 mb-2" size={24} />
              <h3 className="text-white font-bold flex items-center gap-2">
                Entregar al taller
                {cantidadPorEntregar > 0 && (
                  <span className="text-[10px] bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">
                    {cantidadPorEntregar}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#94A3B8] mt-1">Piezas listas para llevar al taller/cliente</p>
            </div>
            <ChevronRight className="text-[#475569] group-hover:text-[#00D4FF]" size={18} />
          </div>
        </Link>

        {/* Reingreso */}
        <Link href="/recojo/reingreso" className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-4 hover:border-red-500/50 transition-colors group">
          <div className="flex items-start justify-between">
            <div>
              <RotateCcw className="text-red-400 mb-2" size={24} />
              <h3 className="text-white font-bold">Registrar reingreso</h3>
              <p className="text-xs text-[#94A3B8] mt-1">Cliente devolvió una pieza por defecto</p>
            </div>
            <ChevronRight className="text-[#475569] group-hover:text-red-400" size={18} />
          </div>
        </Link>
      </div>
    </div>
  )
}
