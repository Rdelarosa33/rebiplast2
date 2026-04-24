'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QrCode, Search, ArrowRight } from 'lucide-react'

export default function ScanPage() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const buscar = async (qr: string) => {
    if (!qr.trim()) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: pieza } = await supabase
      .from('piezas')
      .select('id')
      .eq('qr_code', qr.trim().toUpperCase())
      .single()

    if (pieza) {
      router.push(`/scan/${pieza.id}`)
    } else {
      setError('No se encontró ninguna pieza con ese código QR')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Escanear QR</h1>
        <p className="text-sm text-[#475569] mt-0.5">Busca una pieza por su código</p>
      </div>

      {/* Scanner visual */}
      <div className="card p-8 flex flex-col items-center gap-4">
        <div className="relative w-48 h-48 border-2 border-dashed border-[#1E2D42] rounded-2xl flex items-center justify-center">
          <QrCode size={64} className="text-[#1E2D42]" />
          {/* Corner markers */}
          {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-5 h-5 border-[#00D4FF] ${i < 2 ? 'border-t-2' : 'border-b-2'} ${i % 2 === 0 ? 'border-l-2' : 'border-r-2'} ${i < 2 ? (i === 0 ? 'rounded-tl-lg' : 'rounded-tr-lg') : (i === 2 ? 'rounded-bl-lg' : 'rounded-br-lg')}`} />
          ))}
        </div>
        <p className="text-xs text-[#475569] text-center">
          Escaneo automático próximamente.<br />Por ahora ingresa el código manualmente.
        </p>
      </div>

      {/* Manual input */}
      <div className="card p-5 space-y-3">
        <h2 className="font-medium text-white text-sm">Ingresar código manualmente</h2>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">{error}</div>
        )}
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && buscar(codigo)}
            placeholder="QR-A1B2C3D4"
            className="input-field font-mono flex-1"
            autoFocus
          />
          <button onClick={() => buscar(codigo)} disabled={loading || !codigo}
            className="btn-primary px-4 flex-shrink-0">
            {loading
              ? <div className="w-4 h-4 border-2 border-[#080B12]/30 border-t-[#080B12] rounded-full animate-spin" />
              : <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
