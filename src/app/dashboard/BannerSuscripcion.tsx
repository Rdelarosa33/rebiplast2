import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, CreditCard } from 'lucide-react'
import Link from 'next/link'

export default async function BannerSuscripcion() {
  const supabase = await createClient()
  const { data: sus } = await supabase.from('suscripcion').select('fecha_vencimiento, activa').single()
  const { data: cred } = await supabase.from('creditos_ocr').select('saldo').single()

  if (!sus) return null

  const vencimiento = new Date(sus.fecha_vencimiento)
  const hoy = new Date()
  const diasRestantes = Math.ceil((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  const diasVencida = diasRestantes < 0 ? Math.abs(diasRestantes) : 0

  const mostrarBannerVencida = diasVencida > 0 && diasVencida <= 5
  const mostrarBannerPorVencer = diasRestantes >= 0 && diasRestantes <= 7
  const saldoBajo = (cred?.saldo || 0) < 10

  if (!mostrarBannerVencida && !mostrarBannerPorVencer && !saldoBajo) return null

  return (
    <div className="space-y-2 mb-4">
      {mostrarBannerVencida && (
        <div className="bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400 flex-1">
            <strong>Suscripción vencida.</strong> Tienes {5 - diasVencida} día{5 - diasVencida !== 1 ? 's' : ''} para renovar antes del bloqueo.
          </p>
          <Link href="/admin/suscripcion" className="text-xs text-red-300 border border-red-500/30 px-3 py-1 rounded-lg hover:bg-red-500/10 flex-shrink-0">
            Renovar
          </Link>
        </div>
      )}
      {mostrarBannerPorVencer && !mostrarBannerVencida && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-400 flex-1">
            Tu suscripción vence en <strong>{diasRestantes} día{diasRestantes !== 1 ? 's' : ''}</strong>.
          </p>
          <Link href="/admin/suscripcion" className="text-xs text-amber-300 border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/10 flex-shrink-0">
            Ver
          </Link>
        </div>
      )}
      {saldoBajo && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <CreditCard size={16} className="text-orange-400 flex-shrink-0" />
          <p className="text-sm text-orange-400 flex-1">
            Saldo OCR bajo: <strong>${(cred?.saldo || 0).toFixed(2)}</strong>. Recarga para seguir escaneando órdenes.
          </p>
        </div>
      )}
    </div>
  )
}
