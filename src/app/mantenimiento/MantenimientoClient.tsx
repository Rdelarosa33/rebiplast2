'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, TrendingDown, Check, X, FileText, ScanLine, AlertTriangle } from 'lucide-react'
import { marcarRecargaPagada, registrarPagoDetallado } from './actions'

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

export default function MantenimientoClient({
  recargas,
  usoHistorial,
  escaneosFallidos,
}: {
  recargas: Recarga[]
  usoHistorial: UsoHistorial[]
  escaneosFallidos: number
}) {
  const [recargasAbierto, setRecargasAbierto] = useState(true)
  const [historialAbierto, setHistorialAbierto] = useState(false)
  const [filtroRecargas, setFiltroRecargas] = useState<'todas' | 'pendientes' | 'pagadas'>('pendientes')
  const [modalPago, setModalPago] = useState<Recarga | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const recargasFiltradas = recargas.filter(r => {
    if (filtroRecargas === 'pendientes') return r.automatica && !r.pagada
    if (filtroRecargas === 'pagadas') return r.automatica && r.pagada
    return true
  })

  const marcarRapido = async (recargaId: string) => {
    setLoading(recargaId)
    setErrorMsg('')
    const result = await marcarRecargaPagada(recargaId)
    if (result.error) setErrorMsg(result.error)
    setLoading(null)
  }

  return (
    <>
      {/* Historial de recargas (colapsable) */}
      <div className="card overflow-hidden">
        <button
          onClick={() => setRecargasAbierto(!recargasAbierto)}
          className="w-full flex items-center gap-2 p-5 hover:bg-[#131920] transition-colors"
        >
          <RefreshCw size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white flex-1 text-left">Historial de recargas</h2>
          <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">
            {recargasFiltradas.length}
          </span>
          {recargasAbierto ? <ChevronUp size={18} className="text-[#475569]" /> : <ChevronDown size={18} className="text-[#475569]" />}
        </button>

        {recargasAbierto && (
          <div className="px-5 pb-5 space-y-3">
            {/* Filtros */}
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

            {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

            {/* Lista */}
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
                    {r.automatica && !r.pagada && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => marcarRapido(r.id)}
                          disabled={loading === r.id}
                          className="flex-1 text-xs bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 rounded-lg px-3 py-1.5 flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <Check size={12} />
                          {loading === r.id ? 'Guardando…' : 'Marcar pagada'}
                        </button>
                        <button
                          onClick={() => setModalPago(r)}
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

      {/* Últimos escaneos (colapsable) */}
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
      {modalPago && (
        <ModalPagoDetallado
          recarga={modalPago}
          onClose={() => setModalPago(null)}
          onSuccess={() => setModalPago(null)}
        />
      )}
    </>
  )
}

// =============================================================
// Modal pago detallado
// =============================================================

function ModalPagoDetallado({
  recarga,
  onClose,
  onSuccess,
}: {
  recarga: Recarga
  onClose: () => void
  onSuccess: () => void
}) {
  const [montoPagado, setMontoPagado] = useState(String(recarga.monto))
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [nota, setNota] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const guardar = async () => {
    setLoading(true)
    setError('')
    const result = await registrarPagoDetallado(recarga.id, {
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
          <h3 className="text-lg font-syne font-bold text-white">Registrar pago</h3>
          <button onClick={onClose} className="text-[#475569] hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="bg-[#131920] rounded-xl p-3 text-xs">
          <p className="text-[#475569]">Recarga original</p>
          <p className="text-white mt-0.5">
            <span className="font-semibold text-green-400">${Number(recarga.monto).toFixed(2)}</span>
            {' · '}
            {new Date(recarga.created_at).toLocaleDateString('es-PE')}
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
