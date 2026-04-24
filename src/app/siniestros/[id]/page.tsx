import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ESTADO_LABELS, ESTADO_COLOR } from '@/types'
import { ArrowLeft, QrCode, Clock, CheckCircle, Printer } from 'lucide-react'
import PiezaAcciones from './PiezaAcciones'
import BotonQR from './BotonQR'

export default async function SiniestroDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: siniestro } = await supabase
    .from('siniestros')
    .select('*, piezas(*, historial_piezas(*))')
    .eq('id', id)
    .single()

  if (!siniestro) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from('profiles').select('*').eq('id', user.id).single()
    : { data: null }

  const piezas = siniestro.piezas || []
  const total = piezas.length
  const listo = piezas.filter((p: any) => ['LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length
  const enProceso = piezas.filter((p: any) => !['REGISTRADO','LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/siniestros" className="text-[#475569] hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-syne font-bold text-white font-mono">{siniestro.numero_siniestro}</h1>
          <p className="text-xs text-[#475569]">{siniestro.taller_origen}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Placa', value: siniestro.placa, mono: true },
          { label: 'Marca', value: siniestro.marca || '—' },
          { label: 'Seguro', value: siniestro.tipo_seguro },
          { label: 'Fecha recojo', value: new Date(siniestro.fecha_recojo).toLocaleDateString('es-PE') },
        ].map(item => (
          <div key={item.label} className="card p-3">
            <p className="text-xs text-[#475569]">{item.label}</p>
            <p className={`text-sm font-semibold text-white mt-0.5 ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">Progreso general</span>
          <span className="text-sm text-[#475569]">{listo}/{total} piezas listas</span>
        </div>
        <div className="w-full bg-[#131920] rounded-full h-2">
          <div className="h-2 rounded-full bg-green-500 transition-all"
            style={{ width: total > 0 ? `${Math.round((listo/total)*100)}%` : '0%' }} />
        </div>
        <div className="flex gap-4 mt-3 text-xs text-[#475569]">
          <span className="flex items-center gap-1"><Clock size={12} className="text-amber-400" /> {enProceso} en proceso</span>
          <span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-400" /> {listo} listas</span>
        </div>
      </div>

      {(siniestro.nombre_asegurado || siniestro.nombre_girador || siniestro.observaciones) && (
        <div className="card p-4 space-y-2">
          {siniestro.nombre_asegurado && (
            <div className="flex gap-3"><span className="text-xs text-[#475569] w-24">Asegurado</span><span className="text-sm text-white">{siniestro.nombre_asegurado}</span></div>
          )}
          {siniestro.nombre_girador && (
            <div className="flex gap-3"><span className="text-xs text-[#475569] w-24">Girador</span><span className="text-sm text-white">{siniestro.nombre_girador}</span></div>
          )}
          {siniestro.numero_orden && (
            <div className="flex gap-3"><span className="text-xs text-[#475569] w-24">N° Orden</span><span className="text-sm font-mono text-white">{siniestro.numero_orden}</span></div>
          )}
          {siniestro.observaciones && (
            <div className="flex gap-3"><span className="text-xs text-[#475569] w-24">Obs.</span><span className="text-sm text-[#94A3B8]">{siniestro.observaciones}</span></div>
          )}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex gap-3 flex-wrap">
        <BotonQR siniestroId={siniestro.id} numeroSiniestro={siniestro.numero_siniestro} />
        <Link href={`/siniestros/${siniestro.id}/imprimir`}
          className="flex items-center gap-2 bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] hover:border-[#00D4FF]/30 text-[#94A3B8] hover:text-white px-3 py-2 rounded-xl text-sm transition-all">
          <Printer size={16} />
          Imprimir etiquetas QR
        </Link>
      </div>

      <div>
        <h2 className="font-syne font-semibold text-white mb-3">Piezas ({total})</h2>
        <div className="space-y-2">
          {piezas.map((pieza: any) => (
            <div key={pieza.id} className="card p-4">
              <div className="flex items-start gap-3">
                <QrCode size={16} className="text-[#475569] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{pieza.nombre}</span>
                        {pieza.lado && pieza.lado !== 'N/A' && <span className="text-xs text-[#475569]">{pieza.lado}</span>}
                        {pieza.color && <span className="text-xs text-[#475569]">{pieza.color}</span>}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {pieza.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                        {pieza.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                        {pieza.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                        <span className="text-xs text-[#2D3F55] font-mono">{pieza.qr_code}</span>
                      </div>
                    </div>
                    <span className={`badge ${ESTADO_COLOR[pieza.estado as keyof typeof ESTADO_COLOR]} flex-shrink-0 text-xs`}>
                      {ESTADO_LABELS[pieza.estado as keyof typeof ESTADO_LABELS]}
                    </span>
                  </div>
                  <PiezaAcciones pieza={pieza} role={profile?.role} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
