'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, CheckCircle, Clock, Package, Users, TrendingUp, ShieldCheck, XCircle } from 'lucide-react'
import Link from 'next/link'

const COLORES_SEGURO: Record<string, string> = {
  RIMAC: '#00D4FF', MAPFRE: '#FF4444', PACIFICO: '#00C851',
  LA_POSITIVA: '#FF8800', HDI: '#8B5CF6', INTERSEGURO: '#EC4899', TALLER: '#94A3B8', OTRO: '#475569'
}

const PIPELINE_LABELS: Record<string, string> = {
  ASIGNADO: 'Asignado', EN_REPARACION: 'Reparación', EN_PREPARACION: 'Preparación',
  EN_PINTURA: 'Pintura', EN_PULIDO: 'Pulido', CONTROL_CALIDAD: 'Calidad', LISTO_ENTREGA: 'Listo'
}

const PIPELINE_COLORS: Record<string, string> = {
  ASIGNADO: '#8B5CF6', EN_REPARACION: '#F59E0B', EN_PREPARACION: '#F97316',
  EN_PINTURA: '#EC4899', EN_PULIDO: '#EF4444', CONTROL_CALIDAD: '#A855F7', LISTO_ENTREGA: '#22C55E'
}

export default function DashboardAdminClient({
  pipeline, piezasActivasTotal, terminadasHoy, siniestrosActivos,
  sinAsignarAtrasadas, rechazosTotal, terminadas30dias,
  trabajadoresConCarga, porSeguro, porDia, rendimiento
}: any) {
  const [periodoGrafico, setPeriodoGrafico] = useState<'7' | '14'>('14')
  const [periodoRend, setPeriodoRend] = useState<'semana' | 'mes' | '3meses'>('mes')
  const [periodoRend, setPeriodoRend] = useState<'semana' | 'mes' | '3meses'>('mes')

  const pipelineData = Object.entries(pipeline).map(([key, value]) => ({
    name: PIPELINE_LABELS[key],
    value: value as number,
    color: PIPELINE_COLORS[key]
  })).filter(d => d.value > 0)

  const tasaCalidad = terminadas30dias > 0
    ? Math.round(((terminadas30dias - rechazosTotal) / terminadas30dias) * 100)
    : 100

  const porDiaFiltrado = periodoGrafico === '7' ? porDia.slice(-7) : porDia

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">Dashboard</h1>
        <p className="text-sm text-[#475569] mt-0.5">Vista general del taller</p>
      </div>

      {/* Alertas */}
      {sinAsignarAtrasadas > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-400">
            <strong>{sinAsignarAtrasadas}</strong> pieza{sinAsignarAtrasadas > 1 ? 's' : ''} sin asignar hace más de 24h
          </p>
          <Link href="/supervisor" className="ml-auto text-xs text-amber-400 border border-amber-500/30 px-3 py-1 rounded-lg hover:bg-amber-500/10">
            Ver →
          </Link>
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'En proceso', value: piezasActivasTotal, color: 'text-[#00D4FF]', icon: Package },
          { label: 'Terminadas hoy', value: terminadasHoy, color: 'text-green-400', icon: CheckCircle },
          { label: 'Siniestros activos', value: siniestrosActivos, color: 'text-violet-400', icon: Clock },
          { label: 'Tasa calidad', value: `${tasaCalidad}%`, color: tasaCalidad >= 90 ? 'text-green-400' : tasaCalidad >= 75 ? 'text-amber-400' : 'text-red-400', icon: ShieldCheck },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <k.icon size={18} className={`${k.color} mx-auto mb-2`} />
            <p className={`text-2xl font-syne font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-[#475569] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      {pipelineData.length > 0 && (
        <div className="card p-5">
          <h2 className="font-syne font-semibold text-white mb-4">Pipeline actual</h2>
          <div className="space-y-2">
            {pipelineData.map(d => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-xs text-[#475569] w-24 flex-shrink-0">{d.name}</span>
                <div className="flex-1 bg-[#131920] rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{
                      width: `${Math.max((d.value / Math.max(...pipelineData.map(x => x.value))) * 100, 8)}%`,
                      backgroundColor: d.color + '40',
                      borderRight: `3px solid ${d.color}`
                    }}>
                    <span className="text-xs font-bold" style={{ color: d.color }}>{d.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Piezas terminadas por día */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-semibold text-white">Piezas entregadas</h2>
            <div className="flex gap-1">
              {(['7', '14'] as const).map(p => (
                <button key={p} onClick={() => setPeriodoGrafico(p)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${periodoGrafico === p ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42]'}`}>
                  {p}d
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={porDiaFiltrado}>
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E2D42', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="piezas" stroke="#00D4FF" strokeWidth={2} dot={{ fill: '#00D4FF', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Distribución por seguro */}
        <div className="card p-5">
          <h2 className="font-syne font-semibold text-white mb-4">Por seguro (30 días)</h2>
          {porSeguro.length === 0 ? (
            <p className="text-sm text-[#475569] text-center py-8">Sin datos</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={porSeguro} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                    {porSeguro.map((entry: any) => (
                      <Cell key={entry.name} fill={COLORES_SEGURO[entry.name] || '#475569'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E2D42', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 flex-1">
                {porSeguro.slice(0, 6).map((s: any) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORES_SEGURO[s.name] || '#475569' }} />
                    <span className="text-xs text-[#94A3B8] flex-1">{s.name}</span>
                    <span className="text-xs font-semibold text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Carga laboral */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Carga laboral</h2>
        </div>
        {trabajadoresConCarga.filter((t: any) => t.carga > 0).length === 0 ? (
          <p className="text-sm text-[#475569] text-center py-4">Todos los trabajadores están libres</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(160, trabajadoresConCarga.filter((t: any) => t.carga > 0).length * 36)}>
            <BarChart data={trabajadoresConCarga.filter((t: any) => t.carga > 0)} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E2D42', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="carga" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Rechazos */}
      {rechazosTotal > 0 && (
        <div className="card p-4 flex items-center gap-3">
          <XCircle size={18} className="text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm text-white"><strong className="text-red-400">{rechazosTotal}</strong> rechazos en calidad en los últimos 30 días</p>
            <p className="text-xs text-[#475569]">Tasa de calidad: {tasaCalidad}%</p>
          </div>
        </div>
      )}
      {/* Rendimiento por empleado */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[#00D4FF]" />
            <h2 className="font-syne font-semibold text-white">Rendimiento por empleado</h2>
          </div>
          <div className="flex gap-1">
            {(['semana', 'mes', '3meses'] as const).map(p => (
              <button key={p} onClick={() => setPeriodoRend(p)}
                className={`text-xs px-2 py-1 rounded-lg border transition-all ${periodoRend === p ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42]'}`}>
                {p === 'semana' ? '7d' : p === 'mes' ? '30d' : '90d'}
              </button>
            ))}
          </div>
        </div>
        {!rendimiento?.length ? (
          <p className="text-sm text-[#475569] text-center py-6">Sin datos de rendimiento</p>
        ) : (
          <div className="space-y-3">
            {rendimiento.map((r: any) => (
              <div key={r.id} className="p-3 bg-[#131920] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-white">{r.nombre}</p>
                  <div className="flex gap-2">
                    <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">
                      {r.terminadas} ✓
                    </span>
                    {r.devueltas > 0 && (
                      <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                        {r.devueltas} ✗
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Barra calidad */}
                  <div className="flex-1 bg-[#0D1117] rounded-full h-2">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${r.calidad}%`,
                        backgroundColor: r.calidad >= 90 ? '#22C55E' : r.calidad >= 75 ? '#F59E0B' : '#EF4444'
                      }} />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${
                    r.calidad >= 90 ? 'text-green-400' : r.calidad >= 75 ? 'text-amber-400' : 'text-red-400'
                  }`}>{r.calidad}%</span>
                  {r.tiempoPromedio && (
                    <span className="text-xs text-[#475569]">{r.tiempoPromedio}h prom.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
