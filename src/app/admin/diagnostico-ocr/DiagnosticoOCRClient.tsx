'use client'

import { useState } from 'react'
import { ScanLine, AlertTriangle, ChevronRight, Calendar } from 'lucide-react'
import DebugOCR from '@/app/siniestros/nuevo/DebugOCR'

interface UsoOCR {
  id: string
  created_at: string
  seguro_detectado: string | null
  piezas_extraidas: number | null
  numero_siniestro: string | null
  costo: number | null
  exitoso: boolean | null
  gpt_raw: string | null
  debug_log: any[] | null
  usuario_nombre: string | null
}

export default function DiagnosticoOCRClient({ ultimos }: { ultimos: UsoOCR[] }) {
  const [seleccionado, setSeleccionado] = useState<UsoOCR | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'alertas' | 'fallidos'>('todos')

  const filtrados = ultimos.filter(u => {
    if (filtro === 'fallidos') return !u.exitoso
    if (filtro === 'alertas') {
      const log = Array.isArray(u.debug_log) ? u.debug_log : []
      return log.some((d: any) => d.detectado && !d.match)
    }
    return true
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Lista */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {[
            { key: 'todos', label: 'Todos' },
            { key: 'alertas', label: 'Con alertas' },
            { key: 'fallidos', label: 'Fallidos' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key as any)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filtro === f.key
                  ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold'
                  : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
          {filtrados.length === 0 && (
            <p className="text-xs text-[#475569] text-center py-4">Sin registros</p>
          )}
          {filtrados.map(u => {
            const log = Array.isArray(u.debug_log) ? u.debug_log : []
            const tieneAlerta = log.some((d: any) => d.detectado && !d.match)
            const fecha = new Date(u.created_at)
            const esActivo = seleccionado?.id === u.id

            return (
              <button
                key={u.id}
                onClick={() => setSeleccionado(u)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  esActivo
                    ? 'bg-[#131920] border-[#00D4FF]/40'
                    : 'bg-[#0D1117] border-[#1E2D42] hover:border-[#1E2D42]/80'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {!u.exitoso && <AlertTriangle size={12} className="text-red-400" />}
                  {tieneAlerta && u.exitoso && <AlertTriangle size={12} className="text-amber-400" />}
                  {u.exitoso && !tieneAlerta && <ScanLine size={12} className="text-green-400" />}
                  <span className="text-xs font-mono text-[#00D4FF] flex-1 truncate">
                    {u.numero_siniestro || '— Sin número —'}
                  </span>
                  <ChevronRight size={12} className="text-[#475569]" />
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[#475569]">
                  <Calendar size={10} />
                  <span>{fecha.toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>·</span>
                  <span>{u.seguro_detectado || 'Sin seguro'}</span>
                  <span>·</span>
                  <span>{u.piezas_extraidas || 0} piezas</span>
                </div>
                {u.usuario_nombre && (
                  <p className="text-[10px] text-[#475569] mt-0.5">por {u.usuario_nombre}</p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Detalle */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        {seleccionado ? (
          <div className="space-y-2">
            <div className="card p-3">
              <p className="text-xs text-[#475569]">Detalle del escaneo</p>
              <p className="text-sm font-mono text-[#00D4FF] mt-1">
                {seleccionado.numero_siniestro || 'Sin número'}
              </p>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {new Date(seleccionado.created_at).toLocaleString('es-PE')}
              </p>
            </div>
            <DebugOCR
              debug={seleccionado.debug_log || []}
              gptRaw={seleccionado.gpt_raw || ''}
              data={tryParse(seleccionado.gpt_raw)}
            />
          </div>
        ) : (
          <div className="card p-8 text-center">
            <ScanLine size={32} className="text-[#475569] mx-auto mb-2" />
            <p className="text-sm text-[#475569]">Selecciona un escaneo para ver el detalle</p>
          </div>
        )}
      </div>
    </div>
  )
}

function tryParse(raw: string | null): any {
  if (!raw) return {}
  try {
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch {
    return {}
  }
}
