'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Bug, Copy, Check } from 'lucide-react'

interface DebugEntry {
  campo?: string
  detectado?: any
  final?: any
  candidatos?: any
  desde?: string
  valor?: any
  monto_total?: any
  moneda?: string
  fuente?: string
  prompt_tokens?: number
  cached_tokens?: number
  cache_hit_pct?: number
  completion_tokens?: number
  detalles?: any
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
  const [tab, setTab] = useState<'resumen' | 'detalles' | 'gpt'>('resumen')
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

  // Buscar entradas específicas
  const monto = debug?.find(d => d.campo === 'monto')
  const tokens = debug?.find(d => d.campo === 'tokens')
  const tipoSeleccionado = debug?.find(d => d.campo === 'tipo_seleccionado')
  const seguroInferido = debug?.find(d => d.campo === 'seguro_inferido')
  const promptViolacion = debug?.find(d => d.campo === 'prompt_violacion')

  // Detectar problemas para alertar
  const alertas: string[] = []
  if (data?.piezas?.length === 0) alertas.push('No se detectaron piezas')
  if (!data?.numero_siniestro) alertas.push('No se detectó N° de siniestro')
  if (!data?.numero_orden) alertas.push('No se detectó N° de orden')
  if (!data?.taller_origen) alertas.push('No se detectó taller')
  if (data?.alerta_tipo_seguro) {
    alertas.push(`Tipo no coincide: elegido ${data.tipo_seguro_seleccionado}, GPT detectó ${data.alerta_tipo_seguro}`)
  }
  if (promptViolacion) alertas.push(`GPT intentó usar nombre prohibido (Rebiplast/Rafael)`)

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
              { key: 'detalles', label: 'Detalles' },
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

          {/* Tab Resumen: datos extraídos */}
          {tab === 'resumen' && (
            <div className="space-y-2 text-xs">
              <DebugRow label="Tipo seleccionado" valor={tipoSeleccionado?.valor} />
              <DebugRow label="Tipo final" valor={data?.tipo_seguro} />
              <DebugRow label="N° Siniestro" valor={data?.numero_siniestro} mono />
              <DebugRow label="N° Orden" valor={data?.numero_orden} mono />
              <DebugRow label="Placa" valor={data?.placa} mono />
              <DebugRow label="Marca" valor={data?.marca} />
              <DebugRow label="Color" valor={data?.color} />
              <DebugRow label="Girador" valor={data?.nombre_girador} />
              <DebugRow label="Taller" valor={data?.taller_origen} />
              <DebugRow label="Monto" valor={data?.monto_total ? `${data.moneda} ${data.monto_total}` : null} />
              <DebugRow label="Piezas detectadas" valor={data?.piezas?.length || 0} />
            </div>
          )}

          {/* Tab Detalles: candidatos, tokens, alertas */}
          {tab === 'detalles' && (
            <div className="space-y-3 text-xs">
              {/* Tokens / costo */}
              {tokens && (
                <div className="bg-[#131920] rounded p-2 space-y-1">
                  <p className="font-semibold text-[#94A3B8]">Tokens consumidos</p>
                  <DebugRow label="Prompt total" valor={tokens.prompt_tokens} mono />
                  <DebugRow
                    label="Cacheados"
                    valor={
                      <span className={tokens.cached_tokens && tokens.cached_tokens > 0 ? 'text-green-400' : 'text-[#475569]'}>
                        {tokens.cached_tokens || 0}{' '}
                        {tokens.cache_hit_pct !== undefined && `(${tokens.cache_hit_pct}%)`}
                      </span>
                    }
                  />
                  <DebugRow label="Respuesta" valor={tokens.completion_tokens} mono />
                </div>
              )}

              {/* Candidatos por campo */}
              {data?.candidatos && (
                <div className="bg-[#131920] rounded p-2 space-y-1">
                  <p className="font-semibold text-[#94A3B8]">Candidatos detectados</p>
                  <DebugRow
                    label="Entidades"
                    valor={data.candidatos.entidades?.length > 0 ? data.candidatos.entidades.join(', ') : '—'}
                  />
                  <DebugRow
                    label="Para girador"
                    valor={data.candidatos.candidatos_girador?.length > 0 ? data.candidatos.candidatos_girador.join(', ') : '—'}
                  />
                  <DebugRow
                    label="Para taller"
                    valor={data.candidatos.candidatos_taller?.length > 0 ? data.candidatos.candidatos_taller.join(', ') : '—'}
                  />
                  <DebugRow
                    label="N° documento"
                    valor={data.candidatos.numeros_documento?.length > 0 ? data.candidatos.numeros_documento.join(', ') : '—'}
                  />
                </div>
              )}

              {/* Inferencia de seguro (caso TALLER) */}
              {seguroInferido && (
                <div className="bg-[#131920] rounded p-2 space-y-1">
                  <p className="font-semibold text-[#94A3B8]">Tipo seguro inferido</p>
                  <DebugRow label="Desde" valor={seguroInferido.desde} />
                  <DebugRow label="Valor" valor={seguroInferido.valor} />
                </div>
              )}

              {/* Violación de prompt (silencioso, solo visible aquí) */}
              {promptViolacion && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-2 space-y-1">
                  <p className="font-semibold text-red-400">⚠ Violación del prompt</p>
                  <p className="text-red-300 text-[11px]">
                    GPT intentó devolver: {Array.isArray(promptViolacion.detalles) ? promptViolacion.detalles.join(', ') : String(promptViolacion.detalles)}
                  </p>
                  <p className="text-[#475569] text-[10px]">El backend lo bloqueó automáticamente.</p>
                </div>
              )}
            </div>
          )}

          {/* Tab GPT crudo */}
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
      <span className={`text-white flex-1 break-words ${mono ? 'font-mono' : ''}`}>{display}</span>
    </div>
  )
}
