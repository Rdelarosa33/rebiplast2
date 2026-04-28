import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import { CreditCard, Bug, Wrench } from 'lucide-react'
import Link from 'next/link'
import MantenimientoClient from './MantenimientoClient'

export const revalidate = 0

export default async function MantenimientoPage() {
  const profile = await getCurrentUser()
  if (!profile || profile.role !== 'mantenimiento') redirect('/dashboard')

  const supabase = await createClient()
  const [
    { data: cred },
    { data: usoMes },
    { data: recargas },
    { data: usoHistorial },
  ] = await Promise.all([
    supabase.from('creditos_ocr').select('*').single(),
    supabase.from('uso_ocr').select('costo, exitoso, created_at')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('recargas_ocr').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('uso_ocr').select('id, created_at, seguro_detectado, numero_siniestro, costo, exitoso, piezas_extraidas')
      .order('created_at', { ascending: false }).limit(20),
  ])

  const gastoMes = usoMes?.reduce((acc: number, u: any) => acc + (u.exitoso ? Number(u.costo) : 0), 0) || 0
  const escaneosExitosos = usoMes?.filter((u: any) => u.exitoso).length || 0
  const escaneosFallidos = usoMes?.filter((u: any) => !u.exitoso).length || 0

  // Cálculos de deuda y pagado
  const recargasAuto = recargas?.filter((r: any) => r.automatica) || []
  const deudaPendientes = recargasAuto.filter((r: any) => !r.pagada)
  const deudaTotal = deudaPendientes.reduce((acc: number, r: any) => acc + Number(r.monto), 0)
  const pagosRealizados = recargasAuto.filter((r: any) => r.pagada)
  const totalPagado = pagosRealizados.reduce((acc: number, r: any) => acc + Number(r.monto), 0)

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-syne font-bold text-white flex items-center gap-2">
            <Wrench size={22} className="text-slate-400" />
            Mantenimiento
          </h1>
          <p className="text-sm text-[#475569] mt-0.5">Panel exclusivo de gestión técnica y créditos OCR</p>
        </div>
        <Link
          href="/admin/diagnostico-ocr"
          className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-amber-400 hover:border-amber-400/30 rounded-lg px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
        >
          <Bug size={12} />
          Diagnóstico OCR
        </Link>
      </div>

      {/* Créditos OCR — métricas */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Créditos OCR</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#131920] rounded-xl p-3 text-center">
            <p className="text-2xl font-syne font-bold text-[#00D4FF]">${(cred?.saldo || 0).toFixed(2)}</p>
            <p className="text-xs text-[#475569]">Saldo disponible</p>
          </div>
          <div className="bg-[#131920] rounded-xl p-3 text-center">
            <p className="text-2xl font-syne font-bold text-green-400">{escaneosExitosos}</p>
            <p className="text-xs text-[#475569]">Escaneos este mes</p>
          </div>
          <div className="bg-[#131920] rounded-xl p-3 text-center">
            <p className="text-2xl font-syne font-bold text-amber-400">${gastoMes.toFixed(2)}</p>
            <p className="text-xs text-[#475569]">Gastado este mes</p>
          </div>
        </div>
        <p className="text-[10px] text-[#475569] text-center mt-2">$0.30 por escaneo · Recarga automática $50 cuando saldo ≤ $5</p>
        {(cred?.saldo || 0) < 10 && (
          <div className="mt-3 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-sm text-orange-400">⚠ Saldo bajo — quedan {Math.floor((cred?.saldo || 0) / 0.3)} escaneos disponibles</p>
          </div>
        )}
      </div>

      {/* Resumen deuda y pagos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 border-amber-500/30">
          <p className="text-xs text-[#475569]">Deuda acumulada</p>
          <p className="text-3xl font-syne font-bold text-amber-400 mt-1">${deudaTotal.toFixed(2)}</p>
          <p className="text-xs text-[#475569] mt-1">{deudaPendientes.length} recarga{deudaPendientes.length !== 1 ? 's' : ''} pendiente{deudaPendientes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card p-4 border-green-500/30">
          <p className="text-xs text-[#475569]">Total pagado</p>
          <p className="text-3xl font-syne font-bold text-green-400 mt-1">${totalPagado.toFixed(2)}</p>
          <p className="text-xs text-[#475569] mt-1">{pagosRealizados.length} pago{pagosRealizados.length !== 1 ? 's' : ''} registrado{pagosRealizados.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <MantenimientoClient
        recargas={recargas || []}
        usoHistorial={usoHistorial || []}
        escaneosFallidos={escaneosFallidos}
      />
    </div>
  )
}
