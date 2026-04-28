'use client'

import { useState, useEffect, useRef } from 'react'

interface Sugerencia {
  sigla: string
  nombre_completo: string
}

interface Props {
  value: string
  onChange: (sigla: string, nombre_completo?: string) => void
}

export default function PiezaAutocomplete({ value, onChange }: Props) {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [mostrar, setMostrar] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const debounceRef = useRef<any>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const buscar = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (q.length < 2) {
        setSugerencias([])
        return
      }
      setBuscando(true)
      try {
        const res = await fetch(`/api/buscar-piezas?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSugerencias(data.sugerencias || [])
      } catch {
        setSugerencias([])
      }
      setBuscando(false)
    }, 250)
  }

  return (
    <div className="relative">
      <input
        className="input-field"
        value={value}
        placeholder="FARO DD, FUNDA DELT, MOLD MALETERA..."
        onChange={(e) => {
          const v = e.target.value
          onChange(v)
          buscar(v)
          setMostrar(true)
        }}
        onFocus={() => {
          if (sugerencias.length > 0) setMostrar(true)
        }}
        onBlur={() => {
          // Delay para permitir click en sugerencia
          setTimeout(() => setMostrar(false), 150)
        }}
      />
      {mostrar && (sugerencias.length > 0 || buscando) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D1117] border border-[#1E2D42] rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto">
          {buscando && (
            <div className="px-3 py-2 text-xs text-[#475569]">Buscando en catálogo...</div>
          )}
          {!buscando && sugerencias.length === 0 && (
            <div className="px-3 py-2 text-xs text-[#475569]">Sin coincidencias</div>
          )}
          {sugerencias.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onChange(s.sigla, s.nombre_completo)
                setMostrar(false)
              }}
              className="w-full text-left px-3 py-2 hover:bg-[#131920] border-b border-[#1E2D42] last:border-b-0 transition-colors"
            >
              <div className="text-xs font-mono text-[#00D4FF]">{s.sigla}</div>
              <div className="text-[10px] text-[#94A3B8]">{s.nombre_completo}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
