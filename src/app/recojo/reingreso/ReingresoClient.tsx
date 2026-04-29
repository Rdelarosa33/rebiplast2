'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, RotateCcw, AlertCircle, X } from 'lucide-react'
import { registrarReingreso } from '../actions'

interface Pieza {
  id: string
  nombre: string
  lado: string
  tipo_trabajo: string
  precio: number | null
  updated_at: string | null
  siniestro: {
    id: string
    numero_siniestro: string
    numero_orden: string
    marca: string
    placa: string
    taller_origen: string
    tipo_seguro: string
  }
}

const MOTIVOS = [
  { id: 'pintura_defectuosa', label: 'Pintura defectuosa' },
  { id: 'mala_reparacion', label: 'Mala reparación' },
  { id: 'color_no_coincide', label: 'Color no coincide' },
  { id: 'dano_nuevo', label: 'Daño nuevo (pieza llegó mal)' },
  { id: 'trabajo_incompleto', label: 'Trabajo incompleto' },
  { id: 'otro', label: 'Otro (especificar)' },
]

function normalizar(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function fechaCorta(s: string | null) {
  if (!s) return '-'
  const d = new Date(s)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReingresoClient({ piezas }: { piezas: Pieza[] }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [piezaSeleccionada, setPiezaSeleccionada] = useState<Pieza | null>(null)

  const filtradas = useMemo(() => {
    const bNorm = normalizar(busqueda)
    if (!bNorm) return piezas
    return piezas.filter(p =>
      normalizar(p.siniestro?.numero_siniestro || '').includes(bNorm) ||
      normalizar(p.siniestro?.placa || '').includes(bNorm) ||
      normalizar(p.siniestro?.taller_origen || '').includes(bNorm) ||
      normalizar(p.nombre || '').includes(bNorm)
    )
  }, [piezas, busqueda])

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/recojo" className="p-2 hover:bg-[#131920] rounded text-[#94A3B8]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Registrar reingreso</h1>
          <p className="text-xs text-[#94A3B8]">Buscar la pieza que el cliente devolvió</p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
        <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200">
          Solo se muestran piezas YA ENTREGADAS. Selecciona la pieza, indica el motivo y el supervisor decidirá qué hacer.
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
        <input
          className="input-field pl-9"
          placeholder="Buscar por placa, siniestro, taller o pieza..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtradas.length === 0 ? (
          <div className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-8 text-center">
            <RotateCcw className="mx-auto text-[#475569] mb-3" size={32} />
            <p className="text-sm text-[#94A3B8]">
              {busqueda ? 'Sin resultados' : 'No hay piezas entregadas recientemente'}
            </p>
          </div>
        ) : (
          filtradas.map(p => (
            <button
              key={p.id}
              onClick={() => setPiezaSeleccionada(p)}
              className="w-full bg-[#0D1117] border border-[#1E2D42] rounded-xl p-3 text-left hover:border-red-500/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30 px-1.5 py-0.5 rounded">
                      {p.siniestro?.tipo_seguro}
                    </span>
                    <p className="font-medium text-white text-sm">
                      {p.nombre} {p.lado !== 'N/A' && `· ${p.lado}`}
                    </p>
                    <span className="text-[10px] text-green-400 font-mono">{p.tipo_trabajo}</span>
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">
                    {p.siniestro?.numero_siniestro || '(sin N°)'} · {p.siniestro?.marca} {p.siniestro?.placa} · {p.siniestro?.taller_origen}
                  </p>
                  <p className="text-[10px] text-[#475569] mt-0.5">
                    Entregada: {fechaCorta(p.updated_at)}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {piezaSeleccionada && (
        <ModalReingreso
          pieza={piezaSeleccionada}
          onClose={() => setPiezaSeleccionada(null)}
          onConfirmado={() => {
            setPiezaSeleccionada(null)
            router.push('/recojo')
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function ModalReingreso({
  pieza, onClose, onConfirmado
}: {
  pieza: Pieza
  onClose: () => void
  onConfirmado: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [comentario, setComentario] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const confirmar = () => {
    setError(null)
    if (!motivo) { setError('Selecciona un motivo'); return }
    if (motivo === 'otro' && !comentario.trim()) {
      setError('Si elegiste "Otro", describe el motivo en el comentario')
      return
    }
    startTransition(async () => {
      try {
        await registrarReingreso(pieza.id, motivo, comentario)
        onConfirmado()
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0D1117] border border-[#1E2D42] rounded-t-xl sm:rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#1E2D42] sticky top-0 bg-[#0D1117]">
          <div>
            <h2 className="font-bold text-white">Registrar reingreso</h2>
            <p className="text-[10px] text-[#475569]">{pieza.nombre} · {pieza.siniestro?.placa}</p>
          </div>
          <button onClick={onClose} className="text-[#475569] hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-[#131920] rounded-lg p-3 space-y-1">
            <p className="text-xs text-[#94A3B8]">Pieza:</p>
            <p className="text-sm text-white font-medium">{pieza.nombre} {pieza.lado !== 'N/A' && `· ${pieza.lado}`}</p>
            <p className="text-[10px] text-[#475569]">
              {pieza.siniestro?.tipo_seguro} · {pieza.siniestro?.numero_siniestro} · {pieza.siniestro?.marca} {pieza.siniestro?.placa}
            </p>
          </div>

          <div>
            <label className="label">Motivo del reingreso *</label>
            <div className="space-y-1">
              {MOTIVOS.map(m => (
                <label key={m.id} className="flex items-center gap-2 px-3 py-2 bg-[#131920] border border-[#1E2D42] rounded-lg cursor-pointer hover:border-red-500/50">
                  <input
                    type="radio"
                    name="motivo"
                    value={m.id}
                    checked={motivo === m.id}
                    onChange={e => setMotivo(e.target.value)}
                    className="text-red-500"
                  />
                  <span className="text-sm text-white">{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Comentario {motivo === 'otro' && <span className="text-red-400">*</span>}</label>
            <textarea
              className="input-field min-h-[80px]"
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              placeholder={motivo === 'otro' ? 'Describe el motivo...' : 'Información adicional (opcional)'}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-white rounded-lg text-sm">
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={pending}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              {pending ? 'Registrando...' : 'Confirmar reingreso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
