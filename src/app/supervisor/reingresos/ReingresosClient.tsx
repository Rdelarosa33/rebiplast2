'use client'

import { useState, useTransition } from 'react'
import { RotateCcw, Check, X, AlertCircle, Calendar, User } from 'lucide-react'
import { resolverReingreso } from '@/app/recojo/actions'

interface Evento {
  id: number
  motivo: string
  comentario: string | null
  fecha_entrega_original: string | null
  fecha_reingreso: string
  pieza: {
    id: string
    nombre: string
    lado: string
    tipo_trabajo: string
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
  registrador: { nombre: string; apellido: string } | null
}

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  role: string
}

const MOTIVO_LABELS: Record<string, string> = {
  pintura_defectuosa: 'Pintura defectuosa',
  mala_reparacion: 'Mala reparación',
  color_no_coincide: 'Color no coincide',
  dano_nuevo: 'Daño nuevo',
  trabajo_incompleto: 'Trabajo incompleto',
  otro: 'Otro',
}

function fechaFmt(s: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ReingresosClient({
  eventos, trabajadores
}: {
  eventos: Evento[]
  trabajadores: Trabajador[]
}) {
  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Reingresos pendientes</h1>
        <p className="text-sm text-[#94A3B8]">
          {eventos.length} pieza{eventos.length !== 1 ? 's' : ''} esperando tu decisión
        </p>
      </div>

      {eventos.length === 0 ? (
        <div className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-8 text-center">
          <RotateCcw className="mx-auto text-[#475569] mb-3" size={32} />
          <p className="text-sm text-[#94A3B8]">No hay reingresos pendientes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventos.map(e => <ItemReingreso key={e.id} evento={e} trabajadores={trabajadores} />)}
        </div>
      )}
    </div>
  )
}

function ItemReingreso({ evento, trabajadores }: { evento: Evento; trabajadores: Trabajador[] }) {
  const [accion, setAccion] = useState<'asignar' | 'rechazar' | null>(null)
  const [trabajadorId, setTrabajadorId] = useState<string>('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const ejecutar = () => {
    setError(null)
    if (!accion) return
    if (accion === 'asignar' && !trabajadorId) {
      setError('Selecciona un trabajador')
      return
    }
    startTransition(async () => {
      try {
        await resolverReingreso(evento.id, accion, accion === 'asignar' ? trabajadorId : undefined)
        // El revalidatePath del action hará el refresh
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="bg-[#0D1117] border border-red-500/30 rounded-xl overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30 px-1.5 py-0.5 rounded">
                {evento.pieza.siniestro?.tipo_seguro}
              </span>
              <p className="font-medium text-white text-sm">
                {evento.pieza.nombre} {evento.pieza.lado !== 'N/A' && `· ${evento.pieza.lado}`}
              </p>
              <span className="text-[10px] text-green-400 font-mono">{evento.pieza.tipo_trabajo}</span>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1">
              {evento.pieza.siniestro?.numero_siniestro || '(sin N°)'} · {evento.pieza.siniestro?.marca} {evento.pieza.siniestro?.placa} · {evento.pieza.siniestro?.taller_origen}
            </p>
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-red-500/30 text-red-200 px-1.5 py-0.5 rounded font-medium">
              {MOTIVO_LABELS[evento.motivo] || evento.motivo}
            </span>
          </div>
          {evento.comentario && (
            <p className="text-xs text-red-100 italic">"{evento.comentario}"</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-[10px] text-[#475569]">
          <span className="flex items-center gap-1">
            <Calendar size={10} /> Entregada: {fechaFmt(evento.fecha_entrega_original)}
          </span>
          <span className="flex items-center gap-1">
            <RotateCcw size={10} /> Devuelta: {fechaFmt(evento.fecha_reingreso)}
          </span>
          {evento.registrador && (
            <span className="flex items-center gap-1">
              <User size={10} /> {evento.registrador.nombre} {evento.registrador.apellido}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-[#1E2D42] p-3 bg-[#131920]">
        {!accion ? (
          <div className="flex gap-2">
            <button
              onClick={() => setAccion('asignar')}
              className="flex-1 bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] hover:bg-[#00D4FF]/30 rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1"
            >
              <Check size={14} /> Asignar a trabajador
            </button>
            <button
              onClick={() => setAccion('rechazar')}
              className="flex-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1"
            >
              <X size={14} /> Rechazar reingreso
            </button>
          </div>
        ) : accion === 'asignar' ? (
          <div className="space-y-2">
            <select
              className="input-field text-xs"
              value={trabajadorId}
              onChange={e => setTrabajadorId(e.target.value)}
            >
              <option value="">— Selecciona trabajador —</option>
              {trabajadores.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nombre} {t.apellido} ({t.role === 'recojo_trabajador' ? 'recojo+trabajador' : t.role})
                </option>
              ))}
            </select>
            {error && (
              <p className="text-xs text-red-300 flex items-center gap-1">
                <AlertCircle size={12} /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setAccion(null); setError(null) }} className="flex-1 px-3 py-2 bg-[#131920] border border-[#1E2D42] text-[#94A3B8] rounded-lg text-xs">
                Cancelar
              </button>
              <button onClick={ejecutar} disabled={pending} className="flex-1 btn-primary text-xs disabled:opacity-50">
                {pending ? 'Asignando...' : 'Confirmar asignación'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#94A3B8]">
              ¿Rechazar este reingreso? La pieza volverá a estado ENTREGADO.
            </p>
            {error && (
              <p className="text-xs text-red-300 flex items-center gap-1">
                <AlertCircle size={12} /> {error}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => { setAccion(null); setError(null) }} className="flex-1 px-3 py-2 bg-[#131920] border border-[#1E2D42] text-[#94A3B8] rounded-lg text-xs">
                Cancelar
              </button>
              <button onClick={ejecutar} disabled={pending} className="flex-1 px-3 py-2 bg-amber-500/30 border border-amber-500/50 text-amber-200 rounded-lg text-xs disabled:opacity-50">
                {pending ? 'Procesando...' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
