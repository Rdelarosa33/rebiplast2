import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import { Calendar, CreditCard } from 'lucide-react'
import DesgloseSuscripcion from './DesgloseSuscripcion'
import GestionPagos from '@/app/mantenimiento/GestionPagos'
import { autogenerarDeudas } from '@/app/mantenimiento/actions'

export const revalidate = 0

export default async function SuscripcionPage() {
  const profile = await getCurrentUser()
  if (!profile || !['admin', 'owner'].includes(profile.role)) redirect('/dashboard')

  // Si es owner, auto-generar deudas mensuales que falten antes de mostrar el panel
  if (profile.role === 'owner') {
    await autogenerarDeudas()
  }

  const supabase = await createClient()
  const { data: sus } = await supabase.from('suscripcion').select('*').single()

  const vencimiento = sus ? new Date(sus.fecha_vencimiento) : null
  const hoy = new Date()
  const diasRestantes = vencimiento ? Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : 0

  // Si es owner, traemos también la info de OCR para mostrarla
  const esOwner = profile.role === 'owner'

  let dataOwner: any = null
  if (esOwner) {
    const [
      { data: cred },
      { data: usoMes },
      { data: recargas },
      { data: usoHistorial },
      { data: pagosSus },
    ] = await Promise.all([
      supabase.from('creditos_ocr').select('*').single(),
      supabase.from('uso_ocr').select('costo, exitoso, created_at')
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      supabase.from('recargas_ocr').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('uso_ocr').select('id, created_at, seguro_detectado, numero_siniestro, costo, exitoso, piezas_extraidas')
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('pagos_suscripcion').select('*').order('created_at', { ascending: false }).limit(50),
    ])

    const gastoMes = usoMes?.reduce((acc: number, u: any) => acc + (u.exitoso ? Number(u.costo) : 0), 0) || 0
    const escaneosExitosos = usoMes?.filter((u: any) => u.exitoso).length || 0
    const escaneosFallidos = usoMes?.filter((u: any) => !u.exitoso).length || 0

    dataOwner = {
      cred,
      gastoMes,
      escaneosExitosos,
      escaneosFallidos,
      recargas: recargas || [],
      usoHistorial: usoHistorial || [],
      pagosSus: pagosSus || [],
    }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Suscripción {esOwner ? 'y Créditos' : ''}</h1>
        <p className="text-sm text-[#475569] mt-0.5">{esOwner ? 'Gestión de plan, créditos OCR y pagos' : 'Información del plan contratado'}</p>
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

      {/* Bloque OCR + pagos solo para OWNER */}
      {esOwner && dataOwner && (
        <>
          {/* Métricas OCR */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={18} className="text-[#00D4FF]" />
              <h2 className="font-syne font-semibold text-white">Créditos OCR</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#131920] rounded-xl p-3 text-center">
                <p className="text-2xl font-syne font-bold text-[#00D4FF]">${(dataOwner.cred?.saldo || 0).toFixed(2)}</p>
                <p className="text-xs text-[#475569]">Saldo disponible</p>
              </div>
              <div className="bg-[#131920] rounded-xl p-3 text-center">
                <p className="text-2xl font-syne font-bold text-green-400">{dataOwner.escaneosExitosos}</p>
                <p className="text-xs text-[#475569]">Escaneos este mes</p>
              </div>
              <div className="bg-[#131920] rounded-xl p-3 text-center">
                <p className="text-2xl font-syne font-bold text-amber-400">${dataOwner.gastoMes.toFixed(2)}</p>
                <p className="text-xs text-[#475569]">Gastado este mes</p>
              </div>
            </div>
            <p className="text-[10px] text-[#475569] text-center mt-2">$0.30 por escaneo · Recarga automática $50 cuando saldo ≤ $5</p>
          </div>

          {/* Gestión de pagos (recargas + suscripciones) — Owner SOLO LECTURA, mantenimiento puede modificar */}
          <GestionPagos
            recargas={dataOwner.recargas}
            usoHistorial={dataOwner.usoHistorial}
            escaneosFallidos={dataOwner.escaneosFallidos}
            pagosSus={dataOwner.pagosSus}
            puedeModificar={false}
            precioPlan={sus?.precio_mensual || 300}
          />
        </>
      )}
    </div>
  )
}
