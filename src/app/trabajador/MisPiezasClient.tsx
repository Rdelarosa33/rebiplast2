'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Hammer, QrCode, ChevronRight, AlertTriangle, CheckCircle, Search, TrendingUp, Clock, XCircle, Star } from 'lucide-react'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'

type Periodo = 'semana' | 'mes' | '3meses'

function filtrarPorPeriodo(piezas: any[], periodo: Periodo) {
  const ahora = new Date()
  const dias = periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : 90
  const desde = new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000)
  return piezas.filter(p => new Date(p.updated_at) >= desde)
}

function calcularTiempoPromedio(piezas: any[]) {
  const conTiempo = piezas.filter(p => {
    const inicio = p.historial?.find((h: any) => h.estado_nuevo === 'EN_REPARACION')
    const fin = p.historial?.find((h: any) => h.estado_nuevo === 'CONTROL_CALIDAD')
    return inicio && fin
  })
  if (!conTiempo.length) return null
  const tiempos = conTiempo.map(p => {
    const inicio = new Date(p.historial.find((h: any) => h.estado_nuevo === 'EN_REPARACION').created_at)
    const fin = new Date(p.historial.find((h: any) => h.estado_nuevo === 'CONTROL_CALIDAD').created_at)
    return (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60)
  })
  return (tiempos.reduce((a, b) => a + b, 0) / tiempos.length).toFixed(1)
}

export default function MisPiezasClient({ profile, piezasActivas, piezasTerminadas }: {
  profile: any
  piezasActivas: any[]
  piezasTerminadas: any[]
}) {
  const [tab, setTab] = useState<'activas' | 'stats'>('activas')
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [busqueda, setBusqueda] = useState('')

  const piezasConInfo = piezasActivas.map(p => {
    const rechazos = p.historial?.filter((h: any) => h.estado_nuevo === 'ASIGNADO' && h.motivo) || []
    const rechazo = rechazos.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    return { ...p, devuelta: !!rechazo, motivo_devolucion: rechazo?.motivo, supervisor_devolucion: rechazo?.usuario_nombre }
  })

  const terminadasPeriodo = useMemo(() => filtrarPorPeriodo(piezasTerminadas, periodo), [piezasTerminadas, periodo])

  const terminadasFiltradas = useMemo(() => {
    if (!busqueda) return terminadasPeriodo
    return terminadasPeriodo.filter(p =>
      p.qr_code?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.siniestro?.numero_siniestro?.toLowerCase().includes(busqueda.toLowerCase())
    )
  }, [terminadasPeriodo, busqueda])

  const devueltas = terminadasPeriodo.filter(p =>
    p.historial?.some((h: any) => h.estado_nuevo === 'ASIGNADO' && h.motivo)
  )
  const tasaCalidad = terminadasPeriodo.length > 0
    ? Math.round(((terminadasPeriodo.length - devueltas.length) / terminadasPeriodo.length) * 100)
    : 100
  const tiempoPromedio = calcularTiempoPromedio(terminadasPeriodo)

  const devueltasActivas = piezasConInfo.filter(p => p.devuelta)

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center pt-2 pb-1">
        <h1 className="text-2xl font-syne font-bold text-amber-400">Mis Piezas</h1>
        <p className="text-sm text-[#475569]">{profile.nombre} {profile.apellido}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-[#131920] p-1 rounded-xl">
        <button onClick={() => setTab('activas')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'activas' ? 'bg-[#1E2D42] text-white' : 'text-[#475569]'}`}>
          En proceso ({piezasConInfo.length})
        </button>
        <button onClick={() => setTab('stats')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'stats' ? 'bg-[#1E2D42] text-white' : 'text-[#475569]'}`}>
          Mi desempeño
        </button>
      </div>

      {tab === 'activas' && (
        <>
          {/* Alerta devueltas */}
          {devueltasActivas.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-400" />
                <p className="text-sm font-semibold text-red-400">{devueltasActivas.length} pieza{devueltasActivas.length > 1 ? 's' : ''} devuelta{devueltasActivas.length > 1 ? 's' : ''}</p>
              </div>
              {devueltasActivas.map((p: any) => (
                <Link key={p.id} href={`/scan/${p.id}`} className="block text-xs text-[#94A3B8] hover:text-white py-0.5">
                  • {p.nombre} — "{p.motivo_devolucion}"
                </Link>
              ))}
            </div>
          )}

          {/* Scanner */}
          <Link href="/scan" className="flex items-center justify-between p-4 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00D4FF]/20 flex items-center justify-center">
                <QrCode size={20} className="text-[#00D4FF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Escanear QR</p>
                <p className="text-xs text-[#475569]">Buscar pieza por código</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-[#00D4FF]" />
          </Link>

          {/* Lista activas */}
          {!piezasConInfo.length ? (
            <div className="card p-16 text-center">
              <CheckCircle size={40} className="text-green-400 mx-auto mb-4" />
              <p className="text-white font-medium">Sin piezas pendientes</p>
              <p className="text-xs text-[#2D3F55] mt-1">El supervisor te asignará piezas pronto</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider px-1">Piezas asignadas</p>
              {piezasConInfo.map((p: any) => (
                <Link key={p.id} href={`/scan/${p.id}`}
                  className={`card p-4 flex items-center gap-3 active:scale-[0.98] transition-all ${p.devuelta ? 'border-red-500/30 bg-red-500/5' : 'hover:border-[#00D4FF]/30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.devuelta ? 'bg-red-500/20' : 'bg-[#131920]'}`}>
                    {p.devuelta ? <AlertTriangle size={18} className="text-red-400" /> : <Hammer size={18} className="text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {p.nombre}{p.lado !== 'N/A' && <span className="text-[#475569] font-normal"> — {p.lado}</span>}
                    </p>
                    <p className="text-xs text-[#475569] mt-0.5 truncate">
                      <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>{' · '}{p.siniestro?.placa}
                    </p>
                    {p.devuelta
                      ? <p className="text-xs text-red-400 mt-0.5 truncate">⚠ {p.motivo_devolucion}</p>
                      : <div className="flex gap-2 mt-1">
                          {p.requiere_reparacion && <span className="text-xs text-amber-400">Rep</span>}
                          {p.requiere_pintura && <span className="text-xs text-pink-400">Pin</span>}
                          {p.requiere_pulido && <span className="text-xs text-rose-400">Pul</span>}
                        </div>
                    }
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {p.devuelta
                      ? <span className="text-xs badge bg-red-500/20 text-red-300 border-red-500/30">Devuelta</span>
                      : <span className={`text-xs badge ${ESTADO_COLOR[p.estado as keyof typeof ESTADO_COLOR]}`}>{ESTADO_LABELS[p.estado as keyof typeof ESTADO_LABELS]}</span>
                    }
                    <ChevronRight size={14} className="text-[#2D3F55]" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'stats' && (
        <>
          {/* Filtro periodo */}
          <div className="flex gap-2">
            {(['semana', 'mes', '3meses'] as Periodo[]).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${periodo === p ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF]' : 'bg-[#131920] text-[#475569] border-[#1E2D42]'}`}>
                {p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : '3 Meses'}
              </button>
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 text-center">
              <CheckCircle size={20} className="text-green-400 mx-auto mb-1" />
              <p className="text-2xl font-syne font-bold text-green-400">{terminadasPeriodo.length}</p>
              <p className="text-xs text-[#475569]">Terminadas</p>
            </div>
            <div className="card p-4 text-center">
              <XCircle size={20} className="text-red-400 mx-auto mb-1" />
              <p className="text-2xl font-syne font-bold text-red-400">{devueltas.length}</p>
              <p className="text-xs text-[#475569]">Devueltas</p>
            </div>
            <div className="card p-4 text-center">
              <Star size={20} className="text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-syne font-bold text-amber-400">{tasaCalidad}%</p>
              <p className="text-xs text-[#475569]">Calidad</p>
            </div>
            <div className="card p-4 text-center">
              <Clock size={20} className="text-[#00D4FF] mx-auto mb-1" />
              <p className="text-2xl font-syne font-bold text-[#00D4FF]">{tiempoPromedio ? `${tiempoPromedio}h` : '--'}</p>
              <p className="text-xs text-[#475569]">Tiempo prom.</p>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por QR, pieza o siniestro..."
              className="w-full bg-[#131920] border border-[#1E2D42] rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-[#475569] focus:border-[#00D4FF] focus:outline-none" />
          </div>

          {/* Lista terminadas */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider px-1">
              Piezas terminadas — {terminadasFiltradas.length}
            </p>
            {!terminadasFiltradas.length ? (
              <div className="card p-8 text-center">
                <p className="text-[#475569] text-sm">Sin piezas terminadas en este período</p>
              </div>
            ) : (
              terminadasFiltradas.map((p: any) => {
                // Solo marcar devuelta si el rechazo fue DESPUES del ultimo avance a calidad
                const rechazos = p.historial?.filter((h: any) => h.estado_nuevo === 'ASIGNADO' && h.motivo) || []
                const ultimoRechazo = rechazos.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                const ultimaAprobacion = p.historial?.filter((h: any) => h.estado_nuevo === 'LISTO_ENTREGA')
                  .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                const fueDevuelta = ultimoRechazo && (!ultimaAprobacion || new Date(ultimoRechazo.created_at) > new Date(ultimaAprobacion.created_at))
                return (
                  <Link key={p.id} href={`/scan/${p.id}`} className={`card p-3 flex items-center gap-3 ${fueDevuelta ? 'border-red-500/20' : 'border-green-500/20'} hover:border-[#00D4FF]/30 transition-colors`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${fueDevuelta ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                      {fueDevuelta ? <XCircle size={14} className="text-red-400" /> : <CheckCircle size={14} className="text-green-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                      <p className="text-xs text-[#475569] truncate">
                        <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>{' · '}{p.siniestro?.placa}
                      </p>
                      <p className="text-xs text-[#2D3F55] font-mono">{p.qr_code}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-xs badge ${fueDevuelta ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-green-500/20 text-green-300 border-green-500/30'}`}>
                        {fueDevuelta ? 'Devuelta' : '✓ OK'}
                      </span>
                      <ChevronRight size={12} className="text-[#2D3F55]" />
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
