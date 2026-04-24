'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import QRCode from 'qrcode'
import { Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface Pieza {
  id: string
  qr_code: string
  nombre: string
  lado: string
  color: string
  requiere_reparacion: boolean
  requiere_pintura: boolean
  requiere_pulido: boolean
  es_faro: boolean
}

interface Siniestro {
  id: string
  numero_siniestro: string
  placa: string
  marca: string
  tipo_seguro: string
  taller_origen: string
  piezas: Pieza[]
}

export default function ImprimirEtiquetasPage() {
  const params = useParams()
  const id = params.id as string
  const [siniestro, setSiniestro] = useState<Siniestro | null>(null)
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('siniestros')
      .select('*, piezas(*)')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        if (!data) return
        setSiniestro(data)

        // Generar QR para cada pieza
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

  const imprimir = () => {
    window.print()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 bg-white">
      <p className="text-gray-500">Generando etiquetas...</p>
    </div>
  )

  if (!siniestro) return <p>No encontrado</p>

  return (
    <>
      {/* Controles - solo visibles en pantalla, no se imprimen */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow">
        <Link href={`/siniestros/${id}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={18} />
          <span className="text-sm">Volver</span>
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold text-gray-900">{siniestro.numero_siniestro}</p>
          <p className="text-xs text-gray-500">{siniestro.piezas?.length} etiquetas</p>
        </div>
        <button onClick={imprimir}
          className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Printer size={16} />
          Imprimir
        </button>
      </div>

      {/* Etiquetas - optimizadas para térmica 58mm */}
      <div ref={printRef} className="print-container pt-16">
        {siniestro.piezas?.map((pieza, i) => (
          <div key={pieza.id} className="etiqueta">
            {/* QR */}
            {qrImages[pieza.id] && (
              <img src={qrImages[pieza.id]} alt={`QR ${pieza.qr_code}`} className="qr-img" />
            )}

            {/* Texto */}
            <div className="texto-container">
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
            padding: 8px;
            width: 215px;
            height: 150px;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            font-family: monospace;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
          }
        }

        @media print {
          @page {
            size: 57mm 40mm;
            margin: 0;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .print-container {
            display: block;
            padding: 0;
          }
          .etiqueta {
            width: 57mm;
            height: 40mm;
            padding: 1mm 2mm;
            margin: 0 auto;
            page-break-after: always;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 2mm;
            font-family: monospace;
            overflow: hidden;
          }
          .etiqueta:last-child {
            page-break-after: avoid;
          }
        }

        .qr-img {
          width: 30mm;
          height: 30mm;
          display: block;
          flex-shrink: 0;
        }

        .qr-code {
          font-size: 7px;
          font-family: monospace;
          color: #666;
          margin: 0 0 2px;
          text-align: left;
          letter-spacing: 0.5px;
        }

        .pieza-nombre {
          font-size: 11px;
          font-weight: 900;
          text-align: left;
          margin: 0 0 2px;
          font-family: sans-serif;
          line-height: 1.2;
          text-transform: uppercase;
          color: #000000;
        }

        .pieza-detalle {
          font-size: 9px;
          text-align: left;
          color: #444;
          margin: 1px 0;
          font-family: sans-serif;
        }

        .servicios {
          display: flex;
          gap: 2px;
          margin: 2px 0;
          justify-content: flex-start;
        }

        .servicios span {
          font-size: 9px;
          font-weight: 900;
          font-family: monospace;
          border: 1.5px solid #000;
          padding: 1px 3px;
          border-radius: 2px;
          color: #000000;
        }

        .separador {
          width: 100%;
          border-top: 1px dashed #999;
          margin: 2px 0;
        }

        .sin-numero {
          font-size: 8px;
          font-family: monospace;
          font-weight: bold;
          text-align: left;
          margin: 2px 0 1px;
        }

        .sin-detalle {
          font-size: 8px;
          font-family: sans-serif;
          text-align: left;
          color: #555;
          margin: 0;
        }

        .sin-taller {
          font-size: 7px;
          font-family: sans-serif;
          text-align: left;
          color: #777;
          margin: 0;
        }

        .pieza-num {
          font-size: 7px;
          font-family: monospace;
          color: #999;
          margin-top: 2px;
          text-align: left;
        }

        .texto-container {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
      `}</style>
    </>
  )
}
