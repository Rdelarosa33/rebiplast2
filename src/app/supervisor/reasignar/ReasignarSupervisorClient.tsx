'use client'

import { useState } from 'react'
import { User, RefreshCw, Package, Search } from 'lucide-react'
import ReasignarMasivoModal from '@/app/admin/usuarios/ReasignarMasivoModal'

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  role: string
  cantidad_piezas: number
}

export default function ReasignarSupervisorClient({
  trabajadores,
}: {
  trabajadores: Trabajador[]
}) {
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Trabajador | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'con_piezas' | 'sin_piezas'>('con_piezas')

  // Filtros
  const filtrados = trabajadores
    .filter(t => {
      if (filtro === 'con_piezas') return t.cantidad_piezas > 0
      if (filtro === 'sin_piezas') return t.cantidad_piezas === 0
      return true
    })
    .filter(t => {
      const q = busqueda.toLowerCase().trim()
      if (!q) return true
      return `${t.nombre} ${t.apellido}`.toLowerCase().includes(q)
    })

  const totalConPiezas = trabajadores.filter(t => t.cantidad_piezas > 0).length
  const totalSinPiezas = trabajadores.filter(t => t.cantidad_piezas === 0).length

  return (
    <>
      {/* Filtros y búsqueda */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          {[
            { key: 'con_piezas', label: `Con piezas (${totalConPiezas})` },
            { key: 'sin_piezas', label: `Sin piezas (${totalSinPiezas})` },
            { key: 'todos', label: 'Todos' },
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

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar trabajador…"
            className="input-field w-full pl-9"
          />
        </div>
      </div>

      {/* Lista de trabajadores */}
      <div className="space-y-2">
        {filtrados.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-[#475569]">No hay trabajadores que coincidan</p>
          </div>
        ) : (
          filtrados.map(t => (
            <div key={t.id} className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#131920] flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-[#00D4FF]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {t.nombre} {t.apellido}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Package size={12} className="text-[#475569]" />
                  <p className="text-xs text-[#94A3B8]">
                    {t.cantidad_piezas === 0 ? (
                      <span className="text-[#475569]">Sin piezas activas</span>
                    ) : t.cantidad_piezas === 1 ? (
                      <span className="text-amber-400">1 pieza activa</span>
                    ) : (
                      <span className="text-amber-400">{t.cantidad_piezas} piezas activas</span>
                    )}
                  </p>
                </div>
              </div>
              {t.cantidad_piezas > 0 && (
                <button
                  onClick={() => setSeleccionado(t)}
                  className="text-xs bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-1.5 flex-shrink-0"
                >
                  <RefreshCw size={12} />
                  Reasignar
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal de reasignación masiva (reusa el mismo modal de admin/usuarios) */}
      {seleccionado && (
        <ReasignarMasivoModal
          trabajador={seleccionado}
          otrosTrabajadores={trabajadores
            .filter(t => t.id !== seleccionado.id && t.cantidad_piezas !== undefined)
            .map(t => ({ id: t.id, nombre: t.nombre, apellido: t.apellido, role: t.role }))}
          onClose={() => setSeleccionado(null)}
          onSuccess={() => {
            setSeleccionado(null)
            // Recarga al cerrar para refrescar contadores
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
