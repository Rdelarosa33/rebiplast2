import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import { CreditCard, Calendar, TrendingDown, RefreshCw } from 'lucide-react'

export const revalidate = 0

export default async function SuscripcionPage() {
  const profile = await getCurrentUser()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'owner')) redirect('/dashboard')

  const supabase = await createClient()
  const [
    { data: sus },
    { data: cred },
    { data: usoMes },
    { data: recargas },
    { data: usoHistorial },
  ] = await Promise.all([
    supabase.from('suscripcion').select('*').single(),
    supabase.from('creditos_ocr').select('*').single(),
    supabase.from('uso_ocr').select('costo, exitoso, created_at')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('recargas_ocr').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('uso_ocr').select('*').order('created_at', { ascending: false }).limit(20),
  ])

  const vencimiento = sus ? new Date(sus.fecha_vencimiento) : null
  const hoy = new Date()
  const diasRestantes = vencimiento ? Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)) : 0
  const gastoMes = usoMes?.reduce((acc: number, u: any) => acc + (u.exitoso ? u.costo : 0), 0) || 0
  const escaneosExitosos = usoMes?.filter((u: any) => u.exitoso).length || 0
  const escaneosFallidos = usoMes?.filter((u: any) => !u.exitoso).length || 0

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Suscripción y Créditos</h1>
        <p className="text-sm text-[#475569] mt-0.5">Gestión de plan y créditos OCR</p>
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
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#131920] rounded-xl p-3">
            <p className="text-xs text-[#475569]">Precio mensual</p>
            <p className="text-xl font-syne font-bold text-white">${sus?.precio_mensual || 250}</p>
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
      </div>

      {/* Créditos OCR */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Créditos OCR</h2>
          <span className="text-xs text-[#475569] ml-auto">$0.50 por escaneo</span>
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
        {(cred?.saldo || 0) < 10 && (
          <div className="mt-3 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
            <p className="text-sm text-orange-400">⚠ Saldo bajo — quedan {Math.floor((cred?.saldo || 0) / 0.5)} escaneos disponibles</p>
          </div>
        )}
      </div>

      {/* Historial de escaneos */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Últimos escaneos</h2>
          <span className="text-xs text-[#475569] ml-auto">{escaneosFallidos > 0 ? `${escaneosFallidos} fallidos` : 'Todos exitosos'}</span>
        </div>
        {!usoHistorial?.length ? (
          <p className="text-sm text-[#475569] text-center py-4">Sin escaneos registrados</p>
        ) : (
          <div className="space-y-2">
            {usoHistorial.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${u.exitoso ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{u.usuario_nombre || 'Usuario'}</p>
                  <p className="text-xs text-[#475569]">
                    {u.seguro_detectado || 'Seguro desconocido'} · {u.piezas_extraidas} piezas
                    {u.numero_siniestro && ` · ${u.numero_siniestro}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xs font-semibold ${u.exitoso ? 'text-red-400' : 'text-[#475569]'}`}>
                    {u.exitoso ? `-$${u.costo}` : 'Error'}
                  </p>
                  <p className="text-xs text-[#475569]">
                    {new Date(u.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial recargas */}
      {recargas && recargas.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={18} className="text-[#00D4FF]" />
            <h2 className="font-syne font-semibold text-white">Historial de recargas</h2>
          </div>
          <div className="space-y-2">
            {recargas.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-400">+${r.monto.toFixed(2)}</p>
                  {r.nota && <p className="text-xs text-[#475569]">{r.nota}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs text-white">Saldo: ${r.saldo_nuevo?.toFixed(2)}</p>
                  <p className="text-xs text-[#475569]">
                    {new Date(r.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
