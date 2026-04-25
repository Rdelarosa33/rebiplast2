'use client'

import { useEffect, useState } from 'react'
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
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'H'
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
      <div className="no-print fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between shadow">
        <Link href={`/siniestros/${id}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} />
          <span className="text-sm">Volver</span>
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">{siniestro.numero_siniestro}</p>
          <p className="text-xs text-gray-500">{siniestro.piezas?.length} etiquetas</p>
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Printer size={16} />
          Imprimir
        </button>
      </div>

      {/* Etiquetas */}
      <div className="print-container pt-4 pb-20">
        {siniestro.piezas?.map((pieza: any, i: number) => (
          <div key={pieza.id} className="etiqueta">
            {/* QR */}
            {qrImages[pieza.id] && (
              <img src={qrImages[pieza.id]} alt="QR" className="qr-img" />
            )}
            {/* Pieza */}
            <p className="pieza-nombre">
              {pieza.nombre}{pieza.lado && pieza.lado !== 'N/A' ? ` · ${pieza.lado}` : ''}
            </p>
            {/* Servicios */}
            <div className="servicios">
              {pieza.requiere_reparacion && <span>REP</span>}
              {pieza.requiere_pintura && <span>PIN</span>}
              {pieza.requiere_pulido && <span>PUL</span>}
            </div>
            {/* Separador */}
            <div className="separador" />
            {/* Datos siniestro */}
            <p className="dato"><strong>{siniestro.numero_siniestro}</strong> · {siniestro.numero_orden || ''}</p>
            <p className="dato">{siniestro.placa} · {siniestro.tipo_seguro}</p>
            <p className="dato taller">{siniestro.taller_origen}</p>
            <p className="num">{i + 1}/{siniestro.piezas.length}</p>
          </div>
        ))}
      </div>

      <style>{`
        @media screen {
          body { background: #f0f0f0; }
          .print-container {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            padding: 16px;
            justify-content: center;
          }
          .etiqueta {
            background: white;
            border: 1px solid #ccc;
            border-radius: 6px;
            padding: 8px;
            width: 200px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
        }

        @media print {
          @page {
            size: 56mm 55mm;
            margin: 0;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .print-container { display: block; padding: 0; }
          .etiqueta {
            width: 56mm;
            height: 55mm;
            padding: 6mm 2mm 1.5mm;
            margin: 0;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow: hidden;
          }
          .etiqueta:last-child { page-break-after: avoid; }
        }

        .qr-img {
          width: 30mm;
          height: 30mm;
          display: block;
          margin: 0 auto 2px;
          flex-shrink: 0;
        }

        .pieza-nombre {
          font-size: 11px;
          font-weight: 900;
          text-align: center;
          margin: 1px 0;
          font-family: sans-serif;
          line-height: 1.2;
          text-transform: uppercase;
          color: #000;
        }

        .servicios {
          display: flex;
          gap: 3px;
          margin: 2px 0;
          justify-content: center;
        }

        .servicios span {
          font-size: 10px;
          font-weight: 900;
          font-family: monospace;
          border: 1.5px solid #000;
          padding: 0px 4px;
          border-radius: 2px;
          color: #000;
        }

        .separador {
          width: 90%;
          border-top: 1px dashed #888;
          margin: 2px 0;
        }

        .dato {
          font-size: 8px;
          font-family: monospace;
          text-align: center;
          color: #000;
          margin: 1px 0;
          line-height: 1.2;
        }

        .taller {
          font-size: 7.5px;
          color: #444;
        }

        .num {
          font-size: 7px;
          font-family: monospace;
          color: #888;
          margin-top: 1px;
        }
      `}</style>
    </>
  )
}
