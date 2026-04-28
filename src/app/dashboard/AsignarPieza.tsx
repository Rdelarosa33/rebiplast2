'use client'

import { useState } from 'react'
import { cambiarEstadoPieza, actualizarFlagsPieza } from '@/lib/actions'
import { getTipoTrabajo, getTipoTrabajoDescripcion, validarFlagsPieza } from '@/types'
import { UserCheck, ChevronDown, Pencil, Check, X } from 'lucide-react'

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  carga: number
}

interface FlagsIniciales {
  requiere_reparacion: boolean
  requiere_pintura: boolean
  requiere_pulido: boolean
  es_faro: boolean
}

export default function AsignarPieza({
  piezaId,
  trabajadores,
  flagsIniciales,
  onAsignado,
  onFlagsChange,
}: {
  piezaId: string
  trabajadores: Trabajador[]
  flagsIniciales?: FlagsIniciales
  onAsignado?: (trabajadorNombre: string, trabajadorId: string) => void
  onFlagsChange?: (flags: FlagsIniciales) => void
}) {
  const [seleccionado, setSeleccionado] = useState('')
  const [loading, setLoading] = useState(false)
  const [asignado, setAsignado] = useState(false)
  const [nombreAsignado, setNombreAsignado] = useState('')

  // Estado de flags
  const [editandoFlags, setEditandoFlags] = useState(false)
  const [flags, setFlags] = useState<FlagsIniciales>(
    flagsIniciales ?? {
      requiere_reparacion: true,
      requiere_pintura: false,
      requiere_pulido: false,
      es_faro: false,
    }
  )
  const [flagsBackup, setFlagsBackup] = useState<FlagsIniciales>(flags)
  const [guardandoFlags, setGuardandoFlags] = useState(false)
  const [errorFlags, setErrorFlags] = useState('')

  // Calcular tipo en vivo + validación
  const tipoPreview = getTipoTrabajo(flags)
  const errorValidacion = validarFlagsPieza(flags)

  const abrirEdicion = () => {
    setFlagsBackup(flags)
    setEditandoFlags(true)
    setErrorFlags('')
  }

  const cancelarEdicion = () => {
    setFlags(flagsBackup)
    setEditandoFlags(false)
    setErrorFlags('')
  }

  // Lógica auxiliar: auto-correcciones de consistencia
  const setFlag = (campo: keyof FlagsIniciales, valor: boolean) => {
    const nuevos = { ...flags, [campo]: valor }
    // Si marca pintura, auto-marca reparación (pintura siempre requiere rep)
    if (campo === 'requiere_pintura' && valor) nuevos.requiere_reparacion = true
    // Si desmarca es_faro, también quita pulido
    if (campo === 'es_faro' && !valor) nuevos.requiere_pulido = false
    // Si marca pulido sin ser faro, marca faro automáticamente
    if (campo === 'requiere_pulido' && valor && !nuevos.es_faro) nuevos.es_faro = true
    setFlags(nuevos)
  }

  const guardarFlags = async () => {
    setGuardandoFlags(true)
    setErrorFlags('')
    const result = await actualizarFlagsPieza(piezaId, flags)
    if (result.error) {
      setErrorFlags(result.error)
      setGuardandoFlags(false)
      return
    }
    setEditandoFlags(false)
    setGuardandoFlags(false)
    onFlagsChange?.(flags)
  }

  const asignar = async () => {
    if (!seleccionado) return
    setLoading(true)
    const trab = trabajadores.find(t => t.id === seleccionado)
    const nombre = `${trab?.nombre} ${trab?.apellido}`
    const result = await cambiarEstadoPieza(
      piezaId, 'ASIGNADO',
      `Asignado a ${nombre}`,
      undefined, seleccionado, nombre
    )
    if (!result.error) {
      setAsignado(true)
      setNombreAsignado(nombre)
      onAsignado?.(nombre, seleccionado)
    }
    setLoading(false)
  }

  if (asignado) return (
    <div className="flex items-center gap-2 text-xs text-green-400 py-1">
      <UserCheck size={12} />
      Asignado a {nombreAsignado}
    </div>
  )

  // Modo edición de flags
  if (editandoFlags) {
    return (
      <div className="space-y-2 p-2 bg-[#0D1117] border border-[#1E2D42] rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#475569]">Editar tipo de trabajo</span>
          <span
            className="text-[10px] font-mono font-bold text-[#00D4FF] bg-[#131920] border border-[#1E2D42] px-1.5 py-0.5 rounded"
            title={getTipoTrabajoDescripcion(tipoPreview)}
          >
            {tipoPreview}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FlagCheckbox
            label="Reparación"
            checked={flags.requiere_reparacion}
            onChange={v => setFlag('requiere_reparacion', v)}
            color="text-amber-400"
          />
          <FlagCheckbox
            label="Pintura"
            checked={flags.requiere_pintura}
            onChange={v => setFlag('requiere_pintura', v)}
            color="text-pink-400"
          />
          <FlagCheckbox
            label="Faro"
            checked={flags.es_faro}
            onChange={v => setFlag('es_faro', v)}
            color="text-cyan-400"
          />
          <FlagCheckbox
            label="Pulido"
            checked={flags.requiere_pulido}
            onChange={v => setFlag('requiere_pulido', v)}
            color="text-rose-400"
            disabled={!flags.es_faro}
          />
        </div>
        {(errorValidacion || errorFlags) && (
          <p className="text-xs text-red-400">{errorFlags || errorValidacion}</p>
        )}
        <div className="flex gap-2">
          <button
            onClick={guardarFlags}
            disabled={guardandoFlags || !!errorValidacion}
            className="flex-1 text-xs bg-[#00D4FF] text-[#080B12] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Check size={12} />
            {guardandoFlags ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            onClick={cancelarEdicion}
            disabled={guardandoFlags}
            className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-3 py-1.5 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <X size={12} />
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-center">
      <div className="relative flex-1">
        <select value={seleccionado} onChange={e => setSeleccionado(e.target.value)}
          className="w-full text-xs bg-[#0D1117] border border-[#1E2D42] text-[#94A3B8] rounded-lg px-3 py-1.5 pr-7 appearance-none focus:border-[#00D4FF] focus:outline-none">
          <option value="">Asignar a...</option>
          {trabajadores.map(t => (
            <option key={t.id} value={t.id}>
              {t.nombre} {t.apellido} — {t.carga === 0 ? '✓ Libre' : `${t.carga} piezas`}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
      </div>
      <button
        onClick={abrirEdicion}
        title="Editar tipo de trabajo"
        className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF] px-2 py-1.5 rounded-lg flex-shrink-0"
      >
        <Pencil size={12} />
      </button>
      <button onClick={asignar} disabled={!seleccionado || loading}
        className="text-xs bg-[#00D4FF] text-[#080B12] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50 flex-shrink-0">
        {loading ? '...' : 'Asignar'}
      </button>
    </div>
  )
}

function FlagCheckbox({
  label,
  checked,
  onChange,
  color,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  color: string
  disabled?: boolean
}) {
  return (
    <label className={`flex items-center gap-2 text-xs select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded border-[#1E2D42] bg-[#0D1117] text-[#00D4FF] focus:ring-0 focus:ring-offset-0"
      />
      <span className={checked ? color : 'text-[#475569]'}>{label}</span>
    </label>
  )
}
