import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { redirect } from 'next/navigation'
import { ArrowLeft, ScanLine, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import DiagnosticoOCRClient from './DiagnosticoOCRClient'

export const revalidate = 0

export default async function DiagnosticoOCRPage() {
  const profile = await getCurrentUser()
  if (!profile || !['admin', 'owner'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const { data: ultimos } = await supabase
    .from('uso_ocr')
    .select('id, created_at, seguro_detectado, piezas_extraidas, numero_siniestro, costo, exitoso, gpt_raw, debug_log, usuario_nombre')
    .order('created_at', { ascending: false })
    .limit(50)

  const total = ultimos?.length || 0
  const exitosos = ultimos?.filter(u => u.exitoso).length || 0
  const conAlerta = ultimos?.filter(u => {
    if (!u.debug_log) return false
    const log = Array.isArray(u.debug_log) ? u.debug_log : []
    return log.some((d: any) => d.detectado && !d.match)
  }).length || 0

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/suscripcion" className="text-[#475569] hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-syne font-bold text-white">Diagnóstico OCR</h1>
          <p className="text-xs text-[#475569]">Últimos {total} escaneos para revisar</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <p className="text-xs text-[#475569]">Total</p>
          <p className="text-lg font-bold text-white">{total}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-[#475569]">Exitosos</p>
          <p className="text-lg font-bold text-green-400">{exitosos}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs text-[#475569]">Con alertas</p>
          <p className="text-lg font-bold text-amber-400">{conAlerta}</p>
        </div>
      </div>

      <DiagnosticoOCRClient ultimos={ultimos || []} />
    </div>
  )
}
