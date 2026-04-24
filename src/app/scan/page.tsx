'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, ArrowRight, Camera, X } from 'lucide-react'

export default function ScanPage() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [camaraActiva, setCamaraActiva] = useState(false)
  const scannerRef = useRef<any>(null)

  const buscar = async (qr: string) => {
    if (!qr.trim()) return
    setLoading(true)
    setError('')
    const texto = qr.trim()

    if (texto.includes('/scan/')) {
      const id = texto.split('/scan/').pop()?.split('?')[0]?.split('#')[0]?.trim()
      if (id && id.length > 10) { router.push(`/scan/${id}`); return }
    }

    const supabase = createClient()
    const { data: pieza } = await supabase.from('piezas').select('id').eq('qr_code', texto.toUpperCase()).single()
    if (pieza) {
      router.push(`/scan/${pieza.id}`)
    } else {
      setError(`No se encontró: ${texto}`)
      setLoading(false)
    }
  }

  const detenerCamara = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setCamaraActiva(false)
  }

  useEffect(() => {
    if (!camaraActiva) return
    let mounted = true

    const start = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (!mounted) return

        const scanner = new Html5Qrcode('qr-box')
        scannerRef.current = scanner

        // Obtener cámara trasera directamente
        const devices = await Html5Qrcode.getCameras()
        const camara = devices.find(d =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('trasera') ||
          d.label.toLowerCase().includes('environment')
        ) || devices[devices.length - 1] // última cámara suele ser la trasera

        if (!camara) {
          setError('No se encontró cámara disponible')
          setCamaraActiva(false)
          return
        }

        await scanner.start(
          camara.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => {
            if (!mounted) return
            detenerCamara()
            buscar(text)
          },
          () => {}
        )
      } catch {
        if (mounted) {
          setError('No se pudo acceder a la cámara. Verifica los permisos.')
          setCamaraActiva(false)
        }
      }
    }

    start()
    return () => {
      mounted = false
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {})
        scannerRef.current = null
      }
    }
  }, [camaraActiva])

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Escanear QR</h1>
        <p className="text-sm text-[#475569] mt-0.5">Apunta al código QR de la pieza</p>
      </div>

      {camaraActiva ? (
        <div className="card overflow-hidden relative">
          <div id="qr-box" className="w-full" />
          <button onClick={detenerCamara}
            className="absolute top-3 right-3 w-10 h-10 bg-black/70 rounded-full flex items-center justify-center text-white z-50">
            <X size={20} />
          </button>
          <p className="text-xs text-[#475569] text-center py-2">Apunta la cámara al código QR</p>
        </div>
      ) : (
        <button onClick={() => setCamaraActiva(true)} disabled={loading}
          className="w-full flex items-center justify-center gap-4 py-10 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border-2 border-dashed border-[#00D4FF]/30 rounded-2xl transition-all active:scale-[0.98]">
          <div className="w-14 h-14 rounded-2xl bg-[#00D4FF]/20 flex items-center justify-center">
            <Camera size={30} className="text-[#00D4FF]" />
          </div>
          <div className="text-left">
            <p className="text-lg font-semibold text-white">Abrir cámara</p>
            <p className="text-sm text-[#475569]">Escanear código QR</p>
          </div>
        </button>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>
      )}

      <div className="card p-5 space-y-3">
        <h2 className="font-medium text-white text-sm flex items-center gap-2">
          <Search size={15} className="text-[#475569]" /> Código manual
        </h2>
        <div className="flex gap-2">
          <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && buscar(codigo)}
            placeholder="QR-A1B2C3D4"
            className="input-field font-mono flex-1 text-base"
            autoComplete="off" autoCapitalize="characters" />
          <button onClick={() => buscar(codigo)} disabled={loading || !codigo} className="btn-primary px-4 flex-shrink-0">
            {loading ? <div className="w-4 h-4 border-2 border-[#080B12]/30 border-t-[#080B12] rounded-full animate-spin" /> : <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
