'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QrCode, Search, ArrowRight, Camera, X } from 'lucide-react'

export default function ScanPage() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [camaraActiva, setCamaraActiva] = useState(false)
  const scannerRef = useRef<any>(null)
  const divRef = useRef<HTMLDivElement>(null)

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

  const iniciarCamara = async () => {
    setCamaraActiva(true)
    setError('')
  }

  const detenerCamara = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    setCamaraActiva(false)
  }

  useEffect(() => {
    if (!camaraActiva || !divRef.current) return

    let stopped = false

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            if (stopped) return
            stopped = true
            // Extraer solo el ID si es una URL completa
            let qrCode = decodedText
            if (decodedText.includes('/scan/')) {
              // Es una URL interna — redirigir directo
              const id = decodedText.split('/scan/')[1]
              scanner.stop().catch(() => {})
              router.push(`/scan/${id}`)
              return
            }
            scanner.stop().catch(() => {})
            setCamaraActiva(false)
            buscar(qrCode)
          },
          () => {} // error silencioso por frames sin QR
        )
      } catch (err: any) {
        setError('No se pudo acceder a la cámara. Usa el ingreso manual.')
        setCamaraActiva(false)
      }
    }

    startScanner()

    return () => {
      stopped = true
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
        <p className="text-sm text-[#475569] mt-0.5">Busca una pieza por su código</p>
      </div>

      {/* Cámara activa */}
      {camaraActiva && (
        <div className="card overflow-hidden">
          <div className="relative">
            <div id="qr-reader" ref={divRef} className="w-full" />
            <button onClick={detenerCamara}
              className="absolute top-3 right-3 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 z-10">
              <X size={18} />
            </button>
          </div>
          <div className="p-3 text-center">
            <p className="text-xs text-[#475569]">Apunta la cámara al código QR de la pieza</p>
          </div>
        </div>
      )}

      {/* Botón activar cámara */}
      {!camaraActiva && (
        <button onClick={iniciarCamara}
          className="w-full flex items-center justify-center gap-3 py-6 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border border-[#00D4FF]/30 rounded-2xl transition-all active:scale-[0.98]">
          <div className="w-14 h-14 rounded-2xl bg-[#00D4FF]/20 flex items-center justify-center">
            <Camera size={28} className="text-[#00D4FF]" />
          </div>
          <div className="text-left">
            <p className="text-base font-semibold text-white">Abrir cámara</p>
            <p className="text-xs text-[#475569]">Escanear código QR</p>
          </div>
        </button>
      )}

      {/* Ingreso manual */}
      <div className="card p-5 space-y-3">
        <h2 className="font-medium text-white text-sm flex items-center gap-2">
          <Search size={15} className="text-[#475569]" />
          Ingresar código manualmente
        </h2>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-400">{error}</div>
        )}
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && buscar(codigo)}
            placeholder="QR-A1B2C3D4"
            className="input-field font-mono flex-1 text-base"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
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
