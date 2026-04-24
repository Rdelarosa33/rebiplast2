'use client'

import { useState } from 'react'
import { QrCode, Download, Link, Check } from 'lucide-react'
import QRCode from 'qrcode'

export default function BotonQR({ siniestroId, numeroSiniestro }: { siniestroId: string, numeroSiniestro: string }) {
  const [mostrar, setMostrar] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [copiado, setCopiado] = useState(false)

  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/estado/${siniestroId}`
    : `/estado/${siniestroId}`

  const generarQR = async () => {
    if (!mostrar) {
      const url = await QRCode.toDataURL(`${window.location.origin}/estado/${siniestroId}`, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      })
      setQrUrl(url)
    }
    setMostrar(!mostrar)
  }

  const descargar = () => {
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `QR-${numeroSiniestro}.png`
    a.click()
  }

  const copiarLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/estado/${siniestroId}`)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div>
      <button onClick={generarQR}
        className="flex items-center gap-2 bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] hover:border-[#00D4FF]/30 text-[#94A3B8] hover:text-white px-3 py-2 rounded-xl text-sm transition-all">
        <QrCode size={16} />
        {mostrar ? 'Ocultar QR' : 'Ver QR para taller/seguro'}
      </button>

      {mostrar && qrUrl && (
        <div className="mt-3 p-4 bg-[#131920] border border-[#1E2D42] rounded-xl space-y-3">
          <p className="text-xs text-[#475569]">
            Comparte este QR o link con el taller o la aseguradora para que vean el estado en tiempo real.
            No muestra datos personales ni precios.
          </p>

          {/* QR */}
          <div className="flex justify-center">
            <img src={qrUrl} alt="QR siniestro" className="w-48 h-48 rounded-xl border border-[#1E2D42]" />
          </div>

          {/* Link */}
          <div className="flex items-center gap-2 bg-[#0D1117] border border-[#1E2D42] rounded-xl px-3 py-2">
            <p className="text-xs font-mono text-[#475569] flex-1 truncate">
              {window.location.origin}/estado/{siniestroId}
            </p>
            <button onClick={copiarLink}
              className="flex items-center gap-1 text-xs text-[#00D4FF] hover:text-white transition-colors flex-shrink-0">
              {copiado ? <Check size={14} /> : <Link size={14} />}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          {/* Botones */}
          <div className="flex gap-2">
            <button onClick={descargar}
              className="flex-1 flex items-center justify-center gap-2 bg-[#00D4FF] text-[#080B12] font-semibold px-3 py-2 rounded-xl text-sm hover:bg-[#00D4FF]/90 transition-all">
              <Download size={14} />
              Descargar QR
            </button>
            <button onClick={copiarLink}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1A2332] border border-[#1E2D42] text-[#94A3B8] hover:text-white px-3 py-2 rounded-xl text-sm transition-all">
              {copiado ? <Check size={14} /> : <Link size={14} />}
              {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
