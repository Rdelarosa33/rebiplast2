'use client'

import { useState } from 'react'
import {
  ChevronDown, ChevronUp, RefreshCw, TrendingDown, Check, X, FileText,
  ScanLine, AlertTriangle, Calendar as CalendarIcon, DollarSign
} from 'lucide-react'
import {
  marcarRecargaPagada, registrarPagoDetalladoRecarga,
  marcarSuscripcionPagada, registrarPagoDetalladoSuscripcion,
  generarDeudaSuscripcion,
} from './actions'

interface Recarga {
  id: string
  monto: number
  saldo_anterior: number
  saldo_nuevo: number
  nota: string | null
  automatica: boolean | null
  pagada: boolean | null
  created_at: string
  fecha_pago?: string | null
  monto_pagado?: number | null
}

interface UsoHistorial {
  id: string
  created_at: string
  seguro_detectado: string | null
  numero_siniestro: string | null
  costo: number | null
  exitoso: boolean | null
  piezas_extraidas: number | null
}

interface PagoSus {
  id: string
  monto: number
  periodo: string
  nota: string | null
  pagada: boolean | null
  monto_pagado?: number | null
  fecha_pago?: string | null
  created_at: string
}

export default function GestionPagos({
  recargas,
  usoHistorial,
  escaneosFallidos,
  pagosSus,
  puedeModificar,
  precioPlan,
}: {
  recargas: Recarga[]
  usoHistorial: UsoHistorial[]
  escaneosFallidos: number
  pagosSus: PagoSus[]
  puedeModificar: boolean
  precioPlan: number
}) {
  const [recargasAbierto, setRecargasAbierto] = useState(true)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [planesAbierto, setPlanesAbierto] = useState(true)
  const [filtroRecargas, setFiltroRecargas] = useState<'todas' | 'pendientes' | 'pagadas'>('pendientes')
  const [filtroPlanes, setFiltroPlanes] = useState<'todos' | 'pendientes' | 'pagados'>('pendientes')

  const [modal, setModal] = useState<{ tipo: 'recarga' | 'suscripcion'; item: any } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)

  const recargasAuto = recargas.filter(r => r.automatica)
  const recargasFiltradas = recargasAuto.filter(r => {
    if (filtroRecargas === 'pendientes') return !r.pagada
    if (filtroRecargas === 'pagadas') return r.pagada
    return true
  })

  const planesFiltrados = pagosSus.filter(p => {
    if (filtroPlanes === 'pendientes') return !p.pagada
    if (filtroPlanes === 'pagados') return p.pagada
    return true
  })

  const totalDeudaPlanes = pagosSus.filter(p => !p.pagada).reduce((acc, p) => acc + Number(p.monto), 0)
  const totalDeudaRecargas = recargasAuto.filter(r => !r.pagada).reduce((acc, r) => acc + Number(r.monto), 0)
  const totalDeuda = totalDeudaPlanes + totalDeudaRecargas

  const totalPagadoPlanes = pagosSus.filter(p => p.pagada).reduce((acc, p) => acc + Number(p.monto_pagado || p.monto), 0)
  const totalPagadoRecargas = recargasAuto.filter(r => r.pagada).reduce((acc, r) => acc + Number(r.monto_pagado || r.monto), 0)
  const totalPagado = totalPagadoPlanes + totalPagadoRecargas

  // Acciones
  const marcarRapido = async (item: any, tipo: 'recarga' | 'suscripcion') => {
    setLoading(item.id)
    setErrorMsg('')
    const result = tipo === 'recarga'
      ? await marcarRecargaPagada(item.id)
      : await marcarSuscripcionPagada(item.id)
    if (result.error) setErrorMsg(result.error)
    setLoading(null)
  }

  const generarMes = async () => {
    setGenerando(true)
    setErrorMsg('')
    const result = await generarDeudaSuscripcion()
    if (result.error) setErrorMsg(result.error)
    if (result.warn) setErrorMsg(result.warn)
    setGenerando(false)
  }

  return (
    <>
      {/* Resumen general — totales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 border-amber-500/30">
          <p className="text-xs text-[#475569]">Deuda total acumulada</p>
          <p className="text-3xl font-syne font-bold text-amber-400 mt-1">${totalDeuda.toFixed(2)}</p>
          <p className="text-xs text-[#475569] mt-1">
            ${totalDeudaPlanes.toFixed(2)} planes · ${totalDeudaRecargas.toFixed(2)} recargas
          </p>
        </div>
        <div className="card p-4 border-green-500/30">
          <p className="text-xs text-[#475569]">Total pagado</p>
          <p className="text-3xl font-syne font-bold text-green-400 mt-1">${totalPagado.toFixed(2)}</p>
          <p className="text-xs text-[#475569] mt-1">
            ${totalPagadoPlanes.toFixed(2)} planes · ${totalPagadoRecargas.toFixed(2)} recargas
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-xs text-red-400">{errorMsg}</p>
        </div>
      )}

      {/* PLANES MENSUALES */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setPlanesAbierto(!planesAbierto)}
          className="w-full flex items-center gap-2 p-5 hover:bg-[#131920] transition-colors"
        >
          <CalendarIcon size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white flex-1 text-left">Planes mensuales (${precioPlan}/mes)</h2>
          <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">
            {planesFiltrados.length}
          </span>
          {planesAbierto ? <ChevronUp size={18} className="text-[#475569]" /> : <ChevronDown size={18} className="text-[#475569]" />}
        </button>

        {planesAbierto && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-2">
                {[
                  { key: 'pendientes', label: 'Pendientes' },
                  { key: 'pagados', label: 'Pagados' },
                  { key: 'todos', label: 'Todos' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFiltroPlanes(f.key as any)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      filtroPlanes === f.key
                        ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold'
                        : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {puedeModificar && (
                <button
                  onClick={generarMes}
                  disabled={generando}
                  className="ml-auto text-xs bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30 rounded-lg px-3 py-1.5 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <DollarSign size={12} />
                  {generando ? 'Generando…' : 'Generar deuda del mes'}
                </button>
              )}
            </div>

            {planesFiltrados.length === 0 ? (
              <p className="text-xs text-[#475569] text-center py-4">Sin registros</p>
            ) : (
              <div className="space-y-2">
                {planesFiltrados.map(p => (
                  <div key={p.id} className="p-3 bg-[#131920] rounded-xl space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white">${Number(p.monto).toFixed(2)}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            p.pagada
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {p.pagada ? 'PAGADO' : 'PENDIENTE'}
                          </span>
                          <span className="text-xs text-[#94A3B8] font-mono">{p.periodo}</span>
                        </div>
                        <p className="text-xs text-[#475569] mt-0.5">
                          Generado: {new Date(p.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                        {p.pagada && p.fecha_pago && (
                          <p className="text-xs text-green-400 mt-0.5">
                            Pagado: {new Date(p.fecha_pago).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                            {p.monto_pagado && ` · $${Number(p.monto_pagado).toFixed(2)}`}
                          </p>
                        )}
                        {p.nota && <p className="text-xs text-[#94A3B8] mt-0.5">{p.nota}</p>}
                      </div>
                    </div>
                    {puedeModificar && !p.pagada && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => marcarRapido(p, 'suscripcion')}
                          disabled={loading === p.id}
                          className="flex-1 text-xs bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 rounded-lg px-3 py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Check size={12} />
                          {loading === p.id ? 'Guardando…' : 'Marcar pagado'}
                        </button>
                        <button
                          onClick={() => setModal({ tipo: 'suscripcion', item: p })}
                          className="text-xs bg-[#0D1117] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF] rounded-lg px-3 py-1.5 flex items-center justify-center gap-1"
                        >
                          <FileText size={12} />
                          Detallado
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RECARGAS OCR */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setRecargasAbierto(!recargasAbierto)}
          className="w-full flex items-center gap-2 p-5 hover:bg-[#131920] transition-colors"
        >
          <RefreshCw size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white flex-1 text-left">Recargas OCR</h2>
          <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">
            {recargasFiltradas.length}
          </span>
          {recargasAbierto ? <ChevronUp size={18} className="text-[#475569]" /> : <ChevronDown size={18} className="text-[#475569]" />}
        </button>

        {recargasAbierto && (
          <div className="px-5 pb-5 space-y-3">
            <div className="flex gap-2">
              {[
                { key: 'pendientes', label: 'Pendientes' },
                { key: 'pagadas', label: 'Pagadas' },
                { key: 'todas', label: 'Todas' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFiltroRecargas(f.key as any)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    filtroRecargas === f.key
                      ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold'
                      : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {recargasFiltradas.length === 0 ? (
              <p className="text-xs text-[#475569] text-center py-4">Sin registros</p>
            ) : (
              <div className="space-y-2">
                {recargasFiltradas.map(r => (
                  <div key={r.id} className="p-3 bg-[#131920] rounded-xl space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-green-400">+${Number(r.monto).toFixed(2)}</p>
                          {r.automatica && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                              r.pagada
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}>
                              {r.pagada ? 'PAGADA' : 'PENDIENTE'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#475569] mt-0.5">
                          Recarga: {new Date(r.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {r.pagada && r.fecha_pago && (
                          <p className="text-xs text-green-400 mt-0.5">
                            Pagado: {new Date(r.fecha_pago).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                            {r.monto_pagado && ` · $${Number(r.monto_pagado).toFixed(2)}`}
                          </p>
                        )}
                        {r.nota && <p className="text-xs text-[#94A3B8] mt-0.5">{r.nota}</p>}
                      </div>
                      <div className="text-right text-xs text-[#475569] flex-shrink-0">
                        Saldo: ${Number(r.saldo_nuevo)?.toFixed(2)}
                      </div>
                    </div>
                    {puedeModificar && r.automatica && !r.pagada && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => marcarRapido(r, 'recarga')}
                          disabled={loading === r.id}
                          className="flex-1 text-xs bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 rounded-lg px-3 py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Check size={12} />
                          {loading === r.id ? 'Guardando…' : 'Marcar pagada'}
                        </button>
                        <button
                          onClick={() => setModal({ tipo: 'recarga', item: r })}
                          className="text-xs bg-[#0D1117] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF] rounded-lg px-3 py-1.5 flex items-center justify-center gap-1"
                        >
                          <FileText size={12} />
                          Detallado
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ÚLTIMOS ESCANEOS */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setHistorialAbierto(!historialAbierto)}
          className="w-full flex items-center gap-2 p-5 hover:bg-[#131920] transition-colors"
        >
          <TrendingDown size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white flex-1 text-left">Últimos escaneos</h2>
          <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">
            {usoHistorial.length}
          </span>
          {escaneosFallidos > 0 && (
            <span className="text-[10px] bg-red-500/20 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded">
              {escaneosFallidos} fallidos
            </span>
          )}
          {historialAbierto ? <ChevronUp size={18} className="text-[#475569]" /> : <ChevronDown size={18} className="text-[#475569]" />}
        </button>

        {historialAbierto && (
          <div className="px-5 pb-5">
            {usoHistorial.length === 0 ? (
              <p className="text-xs text-[#475569] text-center py-4">Sin escaneos</p>
            ) : (
              <div className="space-y-2">
                {usoHistorial.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-2.5 bg-[#131920] rounded-xl">
                    {u.exitoso ? <ScanLine size={14} className="text-green-400 flex-shrink-0" /> : <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-[#00D4FF] truncate">{u.numero_siniestro || 'Sin número'}</p>
                      <p className="text-[10px] text-[#475569]">
                        {new Date(u.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {u.seguro_detectado && ` · ${u.seguro_detectado}`}
                        {` · ${u.piezas_extraidas || 0} piezas`}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-[#94A3B8] flex-shrink-0">${Number(u.costo).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal pago detallado */}
      {modal && (
        <ModalPagoDetallado
          tipo={modal.tipo}
          item={modal.item}
          onClose={() => setModal(null)}
          onSuccess={() => setModal(null)}
        />
      )}
    </>
  )
}

// =============================================================
// Modal pago detallado (recarga o suscripción)
// =============================================================

function ModalPagoDetallado({
  tipo,
  item,
  onClose,
  onSuccess,
}: {
  tipo: 'recarga' | 'suscripcion'
  item: any
  onClose: () => void
  onSuccess: () => void
}) {
  const [montoPagado, setMontoPagado] = useState(String(item.monto))
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    setLoading(true)
    setError('')
    const result = tipo === 'recarga'
      ? await registrarPagoDetalladoRecarga(item.id, {
          monto_pagado: parseFloat(montoPagado),
          fecha_pago: fechaPago,
          nota,
        })
      : await registrarPagoDetalladoSuscripcion(item.id, {
          monto_pagado: parseFloat(montoPagado),
          fecha_pago: fechaPago,
          nota,
        })
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1117] border border-[#1E2D42] rounded-2xl p-5 max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-syne font-bold text-white">
            Registrar pago {tipo === 'suscripcion' ? 'de plan' : 'de recarga'}
          </h3>
          <button onClick={onClose} className="text-[#475569] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="bg-[#131920] rounded-xl p-3 text-xs">
          <p className="text-[#475569]">
            {tipo === 'recarga' ? 'Recarga original' : `Plan ${item.periodo}`}
          </p>
          <p className="text-white mt-0.5">
            <span className="font-semibold text-green-400">${Number(item.monto).toFixed(2)}</span>
            {' · '}
            {new Date(item.created_at).toLocaleDateString('es-PE')}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#475569] block mb-1">Monto pagado (USD)</label>
            <input
              type="number"
              step="0.01"
              value={montoPagado}
              onChange={e => setMontoPagado(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="text-xs text-[#475569] block mb-1">Fecha de pago</label>
            <input
              type="date"
              value={fechaPago}
              onChange={e => setFechaPago(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="text-xs text-[#475569] block mb-1">Nota (opcional)</label>
            <textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Ej: Yape 1234 · Pago parcial · etc."
              rows={2}
              className="input-field w-full"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={guardar}
            disabled={loading || !montoPagado || !fechaPago}
            className="flex-1 btn-primary text-sm py-2 disabled:opacity-50"
          >
            {loading ? 'Guardando…' : 'Registrar pago'}
          </button>
          <button onClick={onClose} className="text-sm bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-4 py-2 rounded-lg">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
