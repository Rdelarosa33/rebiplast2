'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ImprimirEtiquetasPage() {
  const params = useParams()
  const id = params.id as string
  const [siniestro, setSiniestro] = useState<any>(null)
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('siniestros')
      .select('*, piezas(*)')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (!data) return
        setSiniestro(data)
        const qrs: Record<string, string> = {}
        for (const pieza of data.piezas || []) {
          const url = `${window.location.origin}/scan/${pieza.id}`
          qrs[pieza.id] = await QRCode.toDataURL(url, {
            width: 200,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M'
          })
        }
        setQrImages(qrs)
        setLoading(false)
      })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64 bg-white">
      <p className="text-gray-500">Generando etiquetas...</p>
    </div>
  )

  if (!siniestro) return <p>No encontrado</p>

  return (
    <>
      {/* Controles */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow">
        <Link href={`/siniestros/${id}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} />
          <span className="text-sm">Volver</span>
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">{siniestro.numero_siniestro}</p>
          <p className="text-xs text-gray-500">{siniestro.piezas?.length} etiquetas — 56mm</p>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Printer size={16} />
          Imprimir
        </button>
      </div>

      {/* Etiquetas */}
      <div className="print-container pt-16">
        {siniestro.piezas?.map((pieza: any, i: number) => (
          <div key={pieza.id} className="etiqueta">
            {qrImages[pieza.id] && (
              <img src={qrImages[pieza.id]} alt={`QR`} className="qr-img" />
            )}
            <p className="qr-code">{pieza.qr_code}</p>
            <p className="pieza-nombre">{pieza.nombre}</p>
            {pieza.lado && pieza.lado !== 'N/A' && (
              <p className="pieza-detalle">{pieza.lado}</p>
            )}
            <div className="servicios">
              {pieza.requiere_reparacion && <span>REP</span>}
              {pieza.requiere_pintura && <span>PIN</span>}
              {pieza.requiere_pulido && <span>PUL</span>}
            </div>
            <div className="separador" />
            <p className="sin-numero">{siniestro.numero_siniestro}</p>
            <p className="sin-detalle">{siniestro.placa} · {siniestro.marca}</p>
            <p className="sin-taller">{siniestro.taller_origen}</p>
            <p className="pieza-num">{i + 1}/{siniestro.piezas.length}</p>
          </div>
        ))}
      </div>

      <style>{`
        @media screen {
          body { background: #f5f5f5; }
          .print-container {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            padding: 16px;
            justify-content: center;
          }
          .etiqueta {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 10px;
            width: 210px;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: monospace;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
        }

        @media print {
          @page {
            size: 56mm auto;
            margin: 0;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .print-container { display: block; padding: 0; }
          .etiqueta {
            width: 52mm;
            padding: 2mm;
            margin: 0 auto;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: monospace;
          }
          .etiqueta:last-child { page-break-after: avoid; }
        }

        .qr-img {
          width: 42mm;
          height: 42mm;
          display: block;
          margin: 0 auto 3px;
        }

        .qr-code {
          font-size: 8px;
          font-family: monospace;
          color: #666;
          margin: 0 0 3px;
          text-align: center;
        }

        .pieza-nombre {
          font-size: 13px;
          font-weight: 900;
          text-align: center;
          margin: 3px 0 2px;
          font-family: sans-serif;
          line-height: 1.2;
          text-transform: uppercase;
          color: #000000;
        }

        .pieza-detalle {
          font-size: 11px;
          text-align: center;
          color: #333;
          margin: 1px 0;
          font-family: sans-serif;
          font-weight: 600;
        }

        .servicios {
          display: flex;
          gap: 4px;
          margin: 3px 0;
          justify-content: center;
        }

        .servicios span {
          font-size: 11px;
          font-weight: 900;
          font-family: monospace;
          border: 2px solid #000;
          padding: 1px 5px;
          border-radius: 3px;
          color: #000000;
        }

        .separador {
          width: 100%;
          border-top: 1px dashed #999;
          margin: 4px 0;
        }

        .sin-numero {
          font-size: 9px;
          font-family: monospace;
          font-weight: bold;
          text-align: center;
          margin: 2px 0;
          color: #000;
        }

        .sin-detalle {
          font-size: 9px;
          font-family: sans-serif;
          text-align: center;
          color: #444;
          margin: 1px 0;
        }

        .sin-taller {
          font-size: 8px;
          font-family: sans-serif;
          text-align: center;
          color: #666;
          margin: 1px 0;
        }

        .pieza-num {
          font-size: 8px;
          font-family: monospace;
          color: #999;
          margin-top: 3px;
          text-align: center;
        }
      `}</style>
    </>
  )
}
