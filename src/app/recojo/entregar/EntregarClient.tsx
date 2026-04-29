'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Search, PackageOpen, Check, AlertCircle, Building2 } from 'lucide-react'
import { entregarPiezasAlTaller } from '../actions'

interface Pieza {
  id: string
  nombre: string
  lado: string
  tipo_trabajo: string
  monto: number | null
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

function normalizar(s: string) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function EntregarClient({ piezas }: { piezas: Pieza[] }) {
  const router = useRouter()
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const agrupadasPorTaller = useMemo(() => {
    const bNorm = normalizar(busqueda)
    const filtradas = piezas.filter(p => {
      if (!bNorm) return true
      return normalizar(p.siniestro?.taller_origen || '').includes(bNorm) ||
        normalizar(p.siniestro?.numero_siniestro || '').includes(bNorm) ||
        normalizar(p.siniestro?.placa || '').includes(bNorm) ||
        normalizar(p.nombre || '').includes(bNorm)
    })

    const grupos: Record<string, { taller: string; siniestros: Record<string, { sin: any; piezas: Pieza[] }> }> = {}
    for (const p of filtradas) {
      const taller = p.siniestro?.taller_origen || '(sin taller)'
      if (!grupos[taller]) grupos[taller] = { taller, siniestros: {} }
      const sinId = p.siniestro?.id
      if (!grupos[taller].siniestros[sinId]) {
        grupos[taller].siniestros[sinId] = { sin: p.siniestro, piezas: [] }
      }
      grupos[taller].siniestros[sinId].piezas.push(p)
    }
    return Object.values(grupos)
  }, [piezas, busqueda])

  const togglePieza = (id: string) => {
    const nuevas = new Set(seleccionadas)
    if (nuevas.has(id)) nuevas.delete(id)
    else nuevas.add(id)
    setSeleccionadas(nuevas)
  }

  const toggleSiniestro = (siniestroId: string, piezasIds: string[]) => {
    const nuevas = new Set(seleccionadas)
    const todasMarcadas = piezasIds.every(id => nuevas.has(id))
    if (todasMarcadas) {
      piezasIds.forEach(id => nuevas.delete(id))
    } else {
      piezasIds.forEach(id => nuevas.add(id))
    }
    setSeleccionadas(nuevas)
  }

  const confirmar = () => {
    setError(null)
    if (seleccionadas.size === 0) {
      setError('Selecciona al menos una pieza')
      return
    }
    startTransition(async () => {
      try {
        await entregarPiezasAlTaller(Array.from(seleccionadas))
        router.push('/recojo')
        router.refresh()
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-4 pb-32">
      <div className="flex items-center gap-2">
        <Link href="/recojo" className="p-2 hover:bg-[#131920] rounded text-[#94A3B8]">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Entregar al taller</h1>
          <p className="text-xs text-[#94A3B8]">{piezas.length} pieza{piezas.length !== 1 ? 's' : ''} lista{piezas.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
        <input
          className="input-field pl-9"
          placeholder="Buscar por taller, siniestro, placa o pieza..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {agrupadasPorTaller.length === 0 ? (
        <div className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-8 text-center">
          <PackageOpen className="mx-auto text-[#475569] mb-3" size={32} />
          <p className="text-sm text-[#94A3B8]">
            {busqueda ? 'Sin resultados' : 'No hay piezas listas para entregar'}
          </p>
        </div>
      ) : (
        agrupadasPorTaller.map(grupo => (
          <div key={grupo.taller} className="bg-[#0D1117] border border-[#1E2D42] rounded-xl overflow-hidden">
            <div className="bg-[#131920] px-3 py-2 flex items-center gap-2 border-b border-[#1E2D42]">
              <Building2 size={14} className="text-green-400" />
              <span className="font-medium text-white text-sm">{grupo.taller}</span>
            </div>
            {Object.values(grupo.siniestros).map(({ sin, piezas: piezasSin }) => {
              const piezasIds = piezasSin.map(p => p.id)
              const todasMarcadas = piezasIds.every(id => seleccionadas.has(id))
              const algunaMarcada = piezasIds.some(id => seleccionadas.has(id))
              return (
                <div key={sin.id} className="border-b border-[#1E2D42] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleSiniestro(sin.id, piezasIds)}
                    className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[#131920]"
                  >
                    <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                      todasMarcadas ? 'bg-green-500 border-green-500' :
                      algunaMarcada ? 'bg-green-500/30 border-green-500' : 'border-[#475569]'
                    }`}>
                      {todasMarcadas && <Check size={12} className="text-[#0A0E1A]" />}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-xs text-white font-medium">
                        {sin.tipo_seguro} · {sin.numero_siniestro || '(sin N°)'} · {sin.marca} {sin.placa}
                      </p>
                      <p className="text-[10px] text-[#475569]">
                        OC: {sin.numero_orden || '-'} · {piezasSin.length} pieza{piezasSin.length !== 1 ? 's' : ''} lista{piezasSin.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                  <div className="px-3 pb-2 space-y-1">
                    {piezasSin.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePieza(p.id)}
                        className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-[#131920] rounded text-left"
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                          seleccionadas.has(p.id) ? 'bg-green-500 border-green-500' : 'border-[#475569]'
                        }`}>
                          {seleccionadas.has(p.id) && <Check size={10} className="text-[#0A0E1A]" />}
                        </div>
                        <span className="text-xs text-[#94A3B8] flex-1 truncate">
                          {p.nombre} {p.lado !== 'N/A' && `· ${p.lado}`}
                        </span>
                        <span className="text-[10px] text-green-400 font-mono">{p.tipo_trabajo}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}

      {agrupadasPorTaller.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#080B12] border-t border-[#1E2D42] p-3">
          <div className="container max-w-3xl mx-auto">
            {error && (
              <div className="flex items-center gap-2 mb-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                <AlertCircle size={14} className="text-red-400" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#94A3B8] flex-1">
                {seleccionadas.size} pieza{seleccionadas.size !== 1 ? 's' : ''} seleccionada{seleccionadas.size !== 1 ? 's' : ''}
              </p>
              <button
                onClick={confirmar}
                disabled={pending || seleccionadas.size === 0}
                className="btn-primary bg-green-600 hover:bg-green-500 flex items-center gap-1 disabled:opacity-50"
              >
                <PackageOpen size={14} />
                {pending ? 'Procesando...' : `Confirmar entrega (${seleccionadas.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
