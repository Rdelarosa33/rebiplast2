'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowRight, User, AlertCircle, RefreshCw } from 'lucide-react'
import { reasignarMasivo, obtenerPiezasActivasDeTrabajador } from './reasignar-actions'

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  role: string
}

export default function ReasignarMasivoModal({
  trabajador,
  otrosTrabajadores,
  onClose,
  onSuccess,
}: {
  trabajador: Trabajador
  otrosTrabajadores: Trabajador[]
  onClose: () => void
  onSuccess: () => void
}) {
  const router = useRouter()
  const [piezas, setPiezas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)
  const [destino, setDestino] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState('')

  // Cargar piezas activas del trabajador
  useEffect(() => {
    obtenerPiezasActivasDeTrabajador(trabajador.id).then(({ piezas: data, error }) => {
      if (error) setError(error)
      else setPiezas(data || [])
      setCargando(false)
    })
  }, [trabajador.id])

  const guardar = async () => {
    if (!destino) {
      setError('Selecciona un trabajador destino')
      return
    }
    setLoading(true)
    setError('')
    const result = await reasignarMasivo(trabajador.id, destino, motivo)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    if (result.warn) {
      setError(result.warn)
      setLoading(false)
      return
    }
    setResultado(result.mensaje || 'Reasignación completada')
    setLoading(false)
    setTimeout(() => {
      router.refresh()
      onSuccess()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1117] border border-[#1E2D42] rounded-2xl p-5 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-syne font-bold text-white flex items-center gap-2">
            <RefreshCw size={18} className="text-amber-400" />
            Reasignación masiva
          </h3>
          <button onClick={onClose} className="text-[#475569] hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Trabajador origen */}
        <div className="bg-[#131920] rounded-xl p-3 space-y-1">
          <p className="text-[10px] text-[#475569] uppercase tracking-wide">Trabajador origen</p>
          <div className="flex items-center gap-2 text-sm">
            <User size={14} className="text-amber-400" />
            <span className="text-white font-semibold">{trabajador.nombre} {trabajador.apellido}</span>
          </div>
        </div>

        {/* Lista de piezas */}
        <div className="bg-[#131920] rounded-xl p-3">
          <p className="text-[10px] text-[#475569] uppercase tracking-wide mb-2">
            Piezas activas a reasignar
          </p>
          {cargando ? (
            <p className="text-xs text-[#475569]">Cargando…</p>
          ) : piezas.length === 0 ? (
            <p className="text-xs text-amber-400">Este trabajador no tiene piezas activas asignadas</p>
          ) : (
            <>
              <p className="text-2xl font-syne font-bold text-amber-400 mb-2">{piezas.length} pieza(s)</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {piezas.slice(0, 8).map((p: any) => (
                  <div key={p.id} className="text-xs text-[#94A3B8] flex items-center gap-2">
                    <span className="font-mono text-[#475569]">{p.qr_code}</span>
                    <span className="truncate flex-1">{p.nombre} {p.lado || ''}</span>
                    <span className="text-[10px] text-amber-400">{p.campos_asignados?.join(', ')}</span>
                  </div>
                ))}
                {piezas.length > 8 && (
                  <p className="text-[10px] text-[#475569] text-center">… y {piezas.length - 8} más</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Destino */}
        {piezas.length > 0 && (
          <>
            <div>
              <label className="text-xs text-[#475569] block mb-1">
                <ArrowRight size={12} className="inline mr-1" />
                Reasignar todas a:
              </label>
              {otrosTrabajadores.length === 0 ? (
                <p className="text-xs text-amber-400">No hay otros trabajadores activos disponibles</p>
              ) : (
                <select
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">— Selecciona —</option>
                  {otrosTrabajadores.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} {t.apellido}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs text-[#475569] block mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Trabajador no asistió hoy"
                className="input-field w-full"
              />
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {resultado && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-2">
            <p className="text-xs text-green-400">✓ {resultado}</p>
          </div>
        )}

        <div className="flex gap-2">
          {piezas.length > 0 && otrosTrabajadores.length > 0 && (
            <button
              onClick={guardar}
              disabled={loading || !destino}
              className="flex-1 btn-primary text-sm py-2 disabled:opacity-50"
            >
              {loading ? 'Reasignando…' : `Reasignar ${piezas.length} pieza(s)`}
            </button>
          )}
          <button onClick={onClose} className="text-sm bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-4 py-2 rounded-lg">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
