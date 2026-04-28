'use client'

import { useState, useEffect } from 'react'
import { X, ArrowRight, User, AlertCircle } from 'lucide-react'
import { reasignarPieza } from '@/app/admin/usuarios/reasignar-actions'
import { createClient } from '@/lib/supabase/client'

interface Trabajador {
  id: string
  nombre: string
  apellido: string | null
  role: string
  activo: boolean
}

export default function ReasignarPiezaModal({
  piezaId,
  campo,
  trabajadorActualId,
  trabajadorActualNombre,
  etiquetaCampo,
  onClose,
  onSuccess,
}: {
  piezaId: string
  campo: 'reparacion' | 'preparacion' | 'pintura'
  trabajadorActualId: string | null
  trabajadorActualNombre: string | null
  etiquetaCampo: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])
  const [seleccionado, setSeleccionado] = useState<string>('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [error, setError] = useState('')

  // Cargar lista de trabajadores activos
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, nombre, apellido, role, activo')
      .in('role', ['trabajador', 'recojo_trabajador'])
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        // Excluir al trabajador actual
        const filtrados = (data || []).filter((t: any) => t.id !== trabajadorActualId)
        setTrabajadores(filtrados)
        setCargandoLista(false)
      })
  }, [trabajadorActualId])

  const guardar = async () => {
    if (!seleccionado) {
      setError('Selecciona un trabajador')
      return
    }
    setLoading(true)
    setError('')
    const result = await reasignarPieza(piezaId, campo, seleccionado, motivo)
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
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1117] border border-[#1E2D42] rounded-2xl p-5 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-syne font-bold text-white">Reasignar pieza</h3>
          <button onClick={onClose} className="text-[#475569] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="bg-[#131920] rounded-xl p-3 space-y-1">
          <p className="text-[10px] text-[#475569] uppercase tracking-wide">{etiquetaCampo}</p>
          <div className="flex items-center gap-2 text-sm">
            <User size={14} className="text-amber-400" />
            <span className="text-white font-semibold">{trabajadorActualNombre || '(sin asignar)'}</span>
            <ArrowRight size={14} className="text-[#475569]" />
            <span className="text-[#475569]">nuevo</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-[#475569] block mb-1">Nuevo trabajador</label>
          {cargandoLista ? (
            <p className="text-xs text-[#475569]">Cargando…</p>
          ) : trabajadores.length === 0 ? (
            <p className="text-xs text-amber-400">No hay otros trabajadores activos disponibles</p>
          ) : (
            <select
              value={seleccionado}
              onChange={e => setSeleccionado(e.target.value)}
              className="input-field w-full"
            >
              <option value="">— Selecciona —</option>
              {trabajadores.map(t => (
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
            placeholder="Ej: Trabajador no asistió"
            className="input-field w-full"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 flex items-start gap-2">
            <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={guardar}
            disabled={loading || !seleccionado}
            className="flex-1 btn-primary text-sm py-2 disabled:opacity-50"
          >
            {loading ? 'Reasignando…' : 'Confirmar'}
          </button>
          <button onClick={onClose} className="text-sm bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-4 py-2 rounded-lg">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
