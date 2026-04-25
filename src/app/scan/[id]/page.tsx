'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cambiarEstadoPieza } from '@/lib/actions'
import { Pieza, Profile, ESTADO_LABELS, ESTADO_COLOR, ROLE_LABELS, getAcciones, Accion } from '@/types'
import { ArrowLeft, CheckCircle, AlertCircle, User, QrCode, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

export default function ScanPiezaPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { id } = params
  const [pieza, setPieza] = useState<Pieza | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [accionLoading, setAccionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState<Accion | null>(null)
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('piezas')
      .select('*, siniestro:siniestros(*), historial:historial_piezas(*)')
      .eq('id', id).single()
      .then(({ data: p }) => { setPieza(p) })

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data: pr }) => { setProfile(pr); setLoading(false) })
    })
  }, [id])

  const ejecutarAccion = async (accion: Accion, motivoText?: string) => {
    if (!pieza || !profile) return
    setAccionLoading(true)
    setError('')
    const result = await cambiarEstadoPieza(pieza.id, accion.estado_nuevo, accion.label, motivoText)
    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`✓ ${ESTADO_LABELS[accion.estado_nuevo]} — ${new Date().toLocaleString('es-PE')}`)
      setPieza(prev => prev ? { ...prev, estado: accion.estado_nuevo } : prev)
    }
    setAccionLoading(false)
    setModal(null)
    setMotivo('')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E2D42] border-t-[#00D4FF] rounded-full animate-spin" />
    </div>
  )

  if (!pieza) return (
    <div className="text-center py-12">
      <p className="text-[#475569]">Pieza no encontrada</p>
      <Link href="/scan" className="btn-primary mt-4 inline-flex">Volver al scanner</Link>
    </div>
  )

  const acciones = profile ? getAcciones(pieza.estado, profile.role, pieza) : []
  const historial = (pieza.historial || [])
    .filter((h: any) => h.estado_nuevo !== 'REGISTRADO')
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-[#475569] hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-syne font-bold text-white">{pieza.nombre}</h1>
          <p className="text-xs font-mono text-[#475569]">{pieza.qr_code}</p>
        </div>
      </div>

      {/* Estado actual */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <span className={`badge ${ESTADO_COLOR[pieza.estado]} text-sm px-3 py-1`}>
            {ESTADO_LABELS[pieza.estado]}
          </span>
          <QrCode size={16} className="text-[#475569]" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <div><p className="text-xs text-[#475569]">Lado</p><p className="text-white">{pieza.lado || '—'}</p></div>
          <div><p className="text-xs text-[#475569]">Color</p><p className="text-white">{pieza.color || '—'}</p></div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {pieza.requiere_reparacion && <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">Reparación</span>}
          {pieza.requiere_pintura && <span className="text-xs bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full">Pintura</span>}
          {pieza.requiere_pulido && <span className="text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full">Pulido</span>}
        </div>
      </div>

      {/* Siniestro */}
      {pieza.siniestro && (
        <Link href={`/siniestros/${pieza.siniestro_id}`} className="card p-4 block hover:border-[#00D4FF]/30 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#475569]">Siniestro</p>
              <p className="text-sm font-mono font-semibold text-[#00D4FF]">{(pieza.siniestro as any).numero_siniestro}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#475569]">Placa</p>
              <p className="text-sm font-mono text-white">{(pieza.siniestro as any).placa}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#475569]">Taller</p>
              <p className="text-xs text-[#94A3B8] max-w-[100px] text-right truncate">{(pieza.siniestro as any).taller_origen}</p>
            </div>
          </div>
        </Link>
      )}

      {/* Asignaciones */}
      {(pieza.trabajador_reparacion_nombre || pieza.trabajador_preparacion_nombre || pieza.trabajador_pintura_nombre) && (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Asignaciones</p>
          {pieza.trabajador_reparacion_nombre && (
            <div className="flex items-center gap-2"><User size={14} className="text-amber-400" /><span className="text-xs text-[#94A3B8]">Reparación:</span><span className="text-xs text-white">{pieza.trabajador_reparacion_nombre}</span></div>
          )}
          {pieza.trabajador_preparacion_nombre && (
            <div className="flex items-center gap-2"><User size={14} className="text-orange-400" /><span className="text-xs text-[#94A3B8]">Preparación:</span><span className="text-xs text-white">{pieza.trabajador_preparacion_nombre}</span></div>
          )}
          {pieza.trabajador_pintura_nombre && (
            <div className="flex items-center gap-2"><User size={14} className="text-pink-400" /><span className="text-xs text-[#94A3B8]">Pintura:</span><span className="text-xs text-white">{pieza.trabajador_pintura_nombre}</span></div>
          )}
        </div>
      )}

      {/* Mensajes */}
      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle size={14} className="text-green-400" />
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Acciones */}
      {profile && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Acciones</p>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#131920] text-[#94A3B8]">{ROLE_LABELS[profile.role]}</span>
          </div>
          {acciones.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-[#475569]">No hay acciones disponibles</p>
              <p className="text-xs text-[#2D3F55] mt-1">
                {pieza.estado === 'ENTREGADO' ? 'Esta pieza ya fue entregada' : 'Este estado no corresponde a tu rol'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {acciones.map((accion, i) => (
                <button key={i} disabled={accionLoading}
                  onClick={() => accion.requiere_motivo ? setModal(accion) : ejecutarAccion(accion)}
                  className={`${accion.color} w-full justify-center disabled:opacity-50`}>
                  {accionLoading
                    ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin mx-auto" />
                    : accion.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-3">Historial</p>
          <div className="space-y-3">
            {historial.slice(0, 10).map((h: any, i: number) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-[#00D4FF] flex-shrink-0 mt-0.5" />
                  {i < historial.length - 1 && <div className="w-px flex-1 bg-[#1E2D42] mt-1" />}
                </div>
                <div className="pb-3 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-white">{h.accion}</span>
                    <span className="text-xs text-[#475569] flex-shrink-0">
                      {new Date(h.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {h.estado_nuevo && (
                    <span className={`badge ${ESTADO_COLOR[h.estado_nuevo as keyof typeof ESTADO_COLOR]} mt-0.5 text-xs`}>
                      {ESTADO_LABELS[h.estado_nuevo as keyof typeof ESTADO_LABELS]}
                    </span>
                  )}
                  {h.usuario_nombre && <p className="text-xs text-[#475569] mt-0.5">{h.usuario_nombre}</p>}
                  {h.motivo && <p className="text-xs text-amber-400 mt-0.5">Motivo: {h.motivo}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de confirmación — SIEMPRE para todas las acciones */}
      {modal && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="card p-5 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="font-syne font-semibold text-white">{modal.label}</h3>
                <p className="text-xs text-[#94A3B8] mt-1">{modal.confirmacion}</p>
              </div>
            </div>

            {modal.requiere_motivo && (
              <div>
                <label className="label">Motivo *</label>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
                  className="input-field" rows={3}
                  placeholder="Describe el problema o motivo del cambio..." />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setModal(null); setMotivo('') }}
                className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button
                onClick={() => ejecutarAccion(modal, modal.requiere_motivo ? motivo : undefined)}
                disabled={accionLoading || (modal.requiere_motivo && !motivo.trim())}
                className={`${modal.color} flex-1 justify-center disabled:opacity-50`}>
                {accionLoading
                  ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
