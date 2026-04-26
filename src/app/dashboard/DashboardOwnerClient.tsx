'use client'

import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Package, CheckCircle, ShieldCheck, Users, Star } from 'lucide-react'

const COLORES_SEGURO: Record<string, string> = {
  RIMAC: '#00D4FF', MAPFRE: '#FF4444', PACIFICO: '#00C851',
  LA_POSITIVA: '#FF8800', HDI: '#8B5CF6', INTERSEGURO: '#EC4899', TALLER: '#94A3B8', OTRO: '#475569'
}

export default function DashboardOwnerClient({
  siniestrosMes, piezasEntregadas, piezasActivas, tasaCalidad,
  trabajadoresActivos, porSeguro, porSemana, porMes, rechazosTotal
}: any) {

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-syne font-bold text-white">RebiplastPRO</h1>
        <p className="text-sm text-[#475569] mt-0.5">Resumen de operaciones</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <Package size={20} className="text-[#00D4FF] mx-auto mb-2" />
          <p className="text-3xl font-syne font-bold text-[#00D4FF]">{siniestrosMes}</p>
          <p className="text-xs text-[#475569] mt-0.5">Siniestros este mes</p>
        </div>
        <div className="card p-4 text-center">
          <CheckCircle size={20} className="text-green-400 mx-auto mb-2" />
          <p className="text-3xl font-syne font-bold text-green-400">{piezasEntregadas}</p>
          <p className="text-xs text-[#475569] mt-0.5">Piezas entregadas (30d)</p>
        </div>
        <div className="card p-4 text-center">
          <TrendingUp size={20} className="text-violet-400 mx-auto mb-2" />
          <p className="text-3xl font-syne font-bold text-violet-400">{piezasActivas}</p>
          <p className="text-xs text-[#475569] mt-0.5">En proceso ahora</p>
        </div>
        <div className="card p-4 text-center">
          <Star size={20} className={`mx-auto mb-2 ${tasaCalidad >= 90 ? 'text-green-400' : tasaCalidad >= 75 ? 'text-amber-400' : 'text-red-400'}`} />
          <p className={`text-3xl font-syne font-bold ${tasaCalidad >= 90 ? 'text-green-400' : tasaCalidad >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{tasaCalidad}%</p>
          <p className="text-xs text-[#475569] mt-0.5">Calidad (30d)</p>
        </div>
        <div className="card p-4 text-center">
          <Users size={20} className="text-amber-400 mx-auto mb-2" />
          <p className="text-3xl font-syne font-bold text-amber-400">{trabajadoresActivos}</p>
          <p className="text-xs text-[#475569] mt-0.5">Trabajadores activos</p>
        </div>
        <div className="card p-4 text-center">
          <ShieldCheck size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-3xl font-syne font-bold text-red-400">{rechazosTotal}</p>
          <p className="text-xs text-[#475569] mt-0.5">Rechazos calidad (30d)</p>
        </div>
      </div>

      {/* Volumen por mes */}
      {porMes.length > 0 && (
        <div className="card p-5">
          <h2 className="font-syne font-semibold text-white mb-4">Siniestros por mes</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={porMes}>
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E2D42', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill="#00D4FF" radius={[4, 4, 0, 0]} name="Siniestros" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Por seguro */}
      {porSeguro.length > 0 && (
        <div className="card p-5">
          <h2 className="font-syne font-semibold text-white mb-4">Distribución por seguro (este mes)</h2>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="45%" height={180}>
              <PieChart>
                <Pie data={porSeguro} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                  {porSeguro.map((entry: any) => (
                    <Cell key={entry.name} fill={COLORES_SEGURO[entry.name] || '#475569'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E2D42', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {porSeguro.map((s: any) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORES_SEGURO[s.name] || '#475569' }} />
                  <span className="text-xs text-[#94A3B8] flex-1">{s.name}</span>
                  <span className="text-xs font-bold text-white">{s.value}</span>
                  <span className="text-xs text-[#475569]">
                    {Math.round((s.value / porSeguro.reduce((a: number, b: any) => a + b.value, 0)) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tendencia reciente */}
      {porSemana.length > 0 && (
        <div className="card p-5">
          <h2 className="font-syne font-semibond text-white mb-4">Tendencia diaria (3 meses)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={porSemana}>
              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#475569' }} axisLine={false} tickLine={false} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E2D42', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke="#00D4FF" strokeWidth={2} dot={false} name="Siniestros" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
