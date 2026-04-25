'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'

interface Pieza {
  id: string
  nombre: string
  lado: string
  estado: string
  tipo_seguro?: string
  siniestro: { numero_siniestro: string, placa: string, taller_origen: string, tipo_seguro: string }
}

const SEGUROS = ['RIMAC', 'PACIFICO', 'MAPFRE', 'LA_POSITIVA', 'HDI', 'INTERSEGURO', 'TALLER']

export function SeccionPorRecibir({ piezas, icon: Icon, color }: { piezas: Pieza[], icon: any, color: string }) {
  const [abierto, setAbierto] = useState(true)
  const [filtroSeguro, setFiltroSeguro] = useState('')

  const filtradas = filtroSeguro
    ? piezas.filter(p => p.siniestro?.tipo_seguro === filtroSeguro)
    : piezas

  const segurosPresentes = Array.from(new Set(piezas.map(p => p.siniestro?.tipo_seguro).filter(Boolean)))

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2 p-4 hover:bg-[#131920] transition-colors">
        <Icon size={18} className={color} />
        <h2 className="font-syne font-semibold text-white flex-1 text-left">Por recibir</h2>
        <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">
          {filtradas.length}{filtroSeguro ? `/${piezas.length}` : ''}
        </span>
        {abierto ? <ChevronUp size={16} className="text-[#475569]" /> : <ChevronDown size={16} className="text-[#475569]" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          {/* Filtros por seguro */}
          {segurosPresentes.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFiltroSeguro('')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  !filtroSeguro ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
                }`}>Todos</button>
              {segurosPresentes.map(s => (
                <button key={s} onClick={() => setFiltroSeguro(s === filtroSeguro ? '' : s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    filtroSeguro === s ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
                  }`}>{s}</button>
              ))}
            </div>
          )}

          {!filtradas.length ? (
            <p className="text-sm text-[#475569] text-center py-2">Sin resultados</p>
          ) : (
            filtradas.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                  <p className="text-xs text-[#475569]">
                    <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                    {' · '}{p.siniestro?.placa}{' · '}{p.siniestro?.tipo_seguro}
                  </p>
                </div>
                <Link href={`/scan/${p.id}`}
                  className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-500/30 transition-colors flex-shrink-0">
                  Recibir
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function SeccionPorAsignar({ piezas, trabajadores, icon: Icon, color }: { piezas: any[], trabajadores: any[], icon: any, color: string }) {
  const [abierto, setAbierto] = useState(true)
  const [filtroSeguro, setFiltroSeguro] = useState('')

  // Dynamic import to avoid circular
  const AsignarPieza = require('./AsignarPieza').default
  const PorAsignarList = require('./PorAsignarList').default

  const filtradas = filtroSeguro
    ? piezas.filter(p => p.siniestro?.tipo_seguro === filtroSeguro)
    : piezas

  const segurosPresentes = Array.from(new Set(piezas.map(p => p.siniestro?.tipo_seguro).filter(Boolean)))

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2 p-4 hover:bg-[#131920] transition-colors">
        <Icon size={18} className={color} />
        <h2 className="font-syne font-semibold text-white flex-1 text-left">Por asignar</h2>
        <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">
          {filtradas.length}{filtroSeguro ? `/${piezas.length}` : ''}
        </span>
        {abierto ? <ChevronUp size={16} className="text-[#475569]" /> : <ChevronDown size={16} className="text-[#475569]" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-3">
          {segurosPresentes.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFiltroSeguro('')}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                  !filtroSeguro ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
                }`}>Todos</button>
              {segurosPresentes.map(s => (
                <button key={s} onClick={() => setFiltroSeguro(s === filtroSeguro ? '' : s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    filtroSeguro === s ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
                  }`}>{s}</button>
              ))}
            </div>
          )}
          <PorAsignarList piezas={filtradas} trabajadores={trabajadores} />
        </div>
      )}
    </div>
  )
}
