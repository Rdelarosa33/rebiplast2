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
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)

  const buscar = async (qr: string) => {
    if (!qr.trim()) return
    setLoading(true)
    setError('')
    const supabase = createClient()

    // Si es URL con /scan/UUID → extraer UUID directo
    if (qr.includes('/scan/')) {
      const id = qr.split('/scan/').pop()?.split('?')[0]?.split('#')[0]?.trim()
      if (id && id.length > 10) {
        router.push(`/scan/${id}`)
        return
      }
    }

    // Buscar por qr_code
    const { data: pieza } = await supabase
      .from('piezas')
      .select('id')
      .eq('qr_code', qr.trim().toUpperCase())
      .single()

    if (pieza) {
      router.push(`/scan/${pieza.id}`)
    } else {
      setError(`No se encontró ninguna pieza con el código: ${qr}`)
      setLoading(false)
    }
  }

  const iniciarCamara = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCamaraActiva(true)
      escanearFrames()
    } catch (err) {
      setError('No se pudo acceder a la cámara. Verifica los permisos del navegador.')
    }
  }

  const detenerCamara = () => {
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCamaraActiva(false)
  }

  const escanearFrames = () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(escanearFrames)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    // Usar BarcodeDetector si está disponible (Chrome Android)
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      detector.detect(canvas).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          detenerCamara()
          buscar(barcodes[0].rawValue)
        } else {
          animFrameRef.current = requestAnimationFrame(escanearFrames)
        }
      }).catch(() => {
        animFrameRef.current = requestAnimationFrame(escanearFrames)
      })
    } else {
      // Fallback: usar html5-qrcode para decodificar
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        Html5Qrcode.scanFile(
          new File([canvas.toDataURL()], 'frame.png'),
          true
        ).then((result: string) => {
          detenerCamara()
          buscar(result)
        }).catch(() => {
          animFrameRef.current = requestAnimationFrame(escanearFrames)
        })
      })
    }
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  return (
    <div className="max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Escanear QR</h1>
        <p className="text-sm text-[#475569] mt-0.5">Busca una pieza por su código</p>
      </div>

      {/* Visor de cámara */}
      {camaraActiva && (
        <div className="card overflow-hidden relative">
          <video ref={videoRef} className="w-full" playsInline muted autoPlay />
          {/* Marco de escaneo */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#00D4FF] rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#00D4FF] rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#00D4FF] rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#00D4FF] rounded-br-lg" />
            </div>
          </div>
          <button onClick={detenerCamara}
            className="absolute top-3 right-3 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white z-10">
            <X size={20} />
          </button>
          <div className="p-3 text-center bg-black/40">
            <p className="text-xs text-white">Apunta al código QR de la pieza</p>
          </div>
        </div>
      )}

      {/* Botón abrir cámara */}
      {!camaraActiva && (
        <button onClick={iniciarCamara} disabled={loading}
          className="w-full flex items-center justify-center gap-4 py-8 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border-2 border-dashed border-[#00D4FF]/30 hover:border-[#00D4FF]/60 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50">
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
