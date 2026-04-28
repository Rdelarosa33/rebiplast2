'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bug, Copy, Check } from 'lucide-react'

interface DebugEntry {
  campo?: string
  detectado?: any
  candidatos?: any
  match?: string
  fuente?: string
  desde?: string
  valor?: any
  monto_total?: any
  moneda?: string
  [key: string]: any
}

export default function DebugOCR({
  debug,
  gptRaw,
  data,
}: {
  debug?: DebugEntry[]
  gptRaw?: string
  data?: any
}) {
  const [abierto, setAbierto] = useState(false)
  const [tab, setTab] = useState<'resumen' | 'gpt' | 'matching'>('resumen')
  const [copiado, setCopiado] = useState(false)

  if (!debug && !gptRaw) return null

  const copiar = async () => {
    const reporte = JSON.stringify({ data, debug, gpt_raw: gptRaw }, null, 2)
    try {
      await navigator.clipboard.writeText(reporte)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  // Agrupar debug por campo para mostrar mejor
  const matching = debug?.filter(d => d.campo && ['seguro', 'girador', 'taller'].includes(d.campo)) || []
  const monto = debug?.find(d => d.campo === 'monto')

  // Detectar problemas comunes para alertar al usuario
  const alertas: string[] = []
  if (data?.tipo_seguro && data.tipo_seguro === '') alertas.push('No se detectó aseguradora')
  if (data?.piezas?.length === 0) alertas.push('No se detectaron piezas')
  matching.forEach(m => {
    if (m.detectado && !m.match) {
      alertas.push(`${m.campo}: GPT leyó "${m.detectado}" pero no hay coincidencia en tabla`)
    }
  })

  return (
    <div className="bg-[#0D1117] border border-amber-500/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2 p-3 hover:bg-[#131920] transition-colors"
      >
        <Bug size={14} className="text-amber-400" />
        <span className="text-xs font-semibold text-amber-400 flex-1 text-left">
          Modo debug OCR
          {alertas.length > 0 && (
            <span className="ml-2 text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded">
              {alertas.length} alerta{alertas.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        {abierto ? <ChevronUp size={14} className="text-[#475569]" /> : <ChevronDown size={14} className="text-[#475569]" />}
      </button>

      {abierto && (
        <div className="p-3 space-y-3 border-t border-[#1E2D42]">
          {/* Alertas */}
          {alertas.length > 0 && (
            <div className="space-y-1">
              {alertas.map((a, i) => (
                <p key={i} className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
                  ⚠ {a}
                </p>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[#1E2D42]">
            {[
              { key: 'resumen', label: 'Resumen' },
              { key: 'matching', label: 'Matching' },
              { key: 'gpt', label: 'GPT crudo' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`text-xs px-3 py-1.5 transition-colors ${
                  tab === t.key
                    ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]'
                    : 'text-[#475569] hover:text-[#94A3B8]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenido por tab */}
          {tab === 'resumen' && (
            <div className="space-y-2 text-xs">
              <DebugRow label="Aseguradora" valor={data?.tipo_seguro} />
              <DebugRow label="N° Siniestro" valor={data?.numero_siniestro} mono />
              <DebugRow label="N° Orden" valor={data?.numero_orden} mono />
              <DebugRow label="Placa" valor={data?.placa} mono />
              <DebugRow label="Marca" valor={data?.marca} />
              <DebugRow label="Color" valor={data?.color} />
              <DebugRow label="Girador" valor={data?.nombre_girador} />
              <DebugRow label="Taller" valor={data?.taller_origen} />
              <DebugRow label="Monto" valor={monto?.monto_total ? `${monto.moneda} ${monto.monto_total}` : null} />
              <DebugRow label="Piezas detectadas" valor={data?.piezas?.length || 0} />
            </div>
          )}

          {tab === 'matching' && (
            <div className="space-y-2 text-xs">
              {matching.map((m, i) => (
                <div key={i} className="bg-[#131920] rounded p-2 space-y-1">
                  <p className="font-semibold text-[#94A3B8] capitalize">{m.campo}</p>
                  <DebugRow label="GPT leyó" valor={m.detectado || '—'} />
                  <DebugRow
                    label="Candidatos"
                    valor={Array.isArray(m.candidatos) && m.candidatos.length > 0 ? m.candidatos.join(', ') : '—'}
                  />
                  <DebugRow
                    label="Match final"
                    valor={m.match || <span className="text-red-400">SIN MATCH</span>}
                  />
                  {m.fuente && (
                    <DebugRow
                      label="Fuente"
                      valor={
                        <span className={
                          m.fuente === 'tabla_exacta' ? 'text-green-400' :
                          m.fuente === 'tabla_alias' ? 'text-cyan-400' :
                          m.fuente?.startsWith('tabla_') ? 'text-amber-400' :
                          'text-[#475569]'
                        }>
                          {m.fuente}
                        </span>
                      }
                    />
                  )}
                </div>
              ))}
              {matching.length === 0 && (
                <p className="text-[#475569]">Sin información de matching</p>
              )}
            </div>
          )}

          {tab === 'gpt' && (
            <div>
              <pre className="text-[10px] text-[#94A3B8] bg-[#131920] rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                {gptRaw || JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}

          {/* Botón copiar reporte completo */}
          <button
            onClick={copiar}
            className="w-full text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF] rounded-lg px-3 py-1.5 flex items-center justify-center gap-1.5"
          >
            {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar reporte para diagnóstico</>}
          </button>
        </div>
      )}
    </div>
  )
}

function DebugRow({ label, valor, mono }: { label: string; valor: any; mono?: boolean }) {
  const display = valor === null || valor === undefined || valor === ''
    ? <span className="text-[#475569]">—</span>
    : typeof valor === 'object' ? <>{valor}</> : valor

  return (
    <div className="flex gap-2">
      <span className="text-[#475569] w-32 flex-shrink-0">{label}</span>
      <span className={`text-white flex-1 truncate ${mono ? 'font-mono' : ''}`}>{display}</span>
    </div>
  )
}
