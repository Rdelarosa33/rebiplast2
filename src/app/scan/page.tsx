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

    // Si es URL con /scan/UUID → extraer UUID
    if (texto.includes('/scan/')) {
      const id = texto.split('/scan/').pop()?.split('?')[0]?.split('#')[0]?.trim()
      if (id && id.length > 10) {
        router.push(`/scan/${id}`)
        return
      }
    }

    // Buscar por qr_code
    const supabase = createClient()
    const { data: pieza } = await supabase
      .from('piezas')
      .select('id')
      .eq('qr_code', texto.toUpperCase())
      .single()

    if (pieza) {
      router.push(`/scan/${pieza.id}`)
    } else {
      setError(`No se encontró: ${texto}`)
      setLoading(false)
    }
  }

  const iniciarCamara = async () => {
    setError('')
    setCamaraActiva(true)
  }

  const detenerCamara = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {}
      scannerRef.current = null
    }
    setCamaraActiva(false)
  }

  useEffect(() => {
    if (!camaraActiva) return

    let mounted = true

    const startScanner = async () => {
      try {
        const { Html5QrcodeScanner } = await import('html5-qrcode')

        if (!mounted) return

        const scanner = new Html5QrcodeScanner(
          'html5-qrcode-container',
          {
            fps: 10,
            qrbox: 250,
            rememberLastUsedCamera: true,
            supportedScanTypes: [0], // solo cámara
          },
          false
        )

        scannerRef.current = scanner

        scanner.render(
          (decodedText: string) => {
            if (!mounted) return
            detenerCamara()
            buscar(decodedText)
          },
          () => {} // errores de frame silenciosos
        )
      } catch (err) {
        setError('No se pudo iniciar la cámara.')
        setCamaraActiva(false)
      }
    }

    startScanner()

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
        <p className="text-sm text-[#475569] mt-0.5">Busca una pieza por su código</p>
      </div>

      {/* Scanner */}
      {camaraActiva && (
        <div className="card overflow-hidden">
          <div className="relative">
            <div id="html5-qrcode-container" className="w-full" />
            <button onClick={detenerCamara}
              className="absolute top-3 right-3 w-10 h-10 bg-black/70 rounded-full flex items-center justify-center text-white z-50">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Botón abrir cámara */}
      {!camaraActiva && (
        <button onClick={iniciarCamara} disabled={loading}
          className="w-full flex items-center justify-center gap-4 py-8 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border-2 border-dashed border-[#00D4FF]/30 rounded-2xl transition-all active:scale-[0.98]">
          <div className="w-14 h-14 rounded-2xl bg-[#00D4FF]/20 flex items-center justify-center">
            <Camera size={30} className="text-[#00D4FF]" />
          </div>
          <div className="text-left">
            <p className="text-lg font-semibold text-white">Abrir cámara</p>
            <p className="text-sm text-[#475569]">Escanear código QR</p>
          </div>
        </button>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Ingreso manual */}
      <div className="card p-5 space-y-3">
        <h2 className="font-medium text-white text-sm flex items-center gap-2">
          <Search size={15} className="text-[#475569]" />
          Ingresar código manualmente
        </h2>
        <div className="flex gap-2">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && buscar(codigo)}
            placeholder="QR-A1B2C3D4"
            className="input-field font-mono flex-1 text-base"
            autoComplete="off"
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
