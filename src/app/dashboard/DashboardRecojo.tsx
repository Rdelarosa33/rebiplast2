'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { Plus, ClipboardList, Package, Truck, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

export default function DashboardRecojo() {
  const [profile, setProfile] = useState<any>(null)
  const [listosEntrega, setListosEntrega] = useState<any[]>([])
  const [misRegistros, setMisRegistros] = useState<any[]>([])
  const [filtro, setFiltro] = useState('mis')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [mostrarListos, setMostrarListos] = useState(true)
  const [loading, setLoading] = useState(true)

  const hoy = new Date().toISOString().split('T')[0]
  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const inicioSemanaStr = inicioSemana.toISOString().split('T')[0]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  useEffect(() => {
    if (!profile) return
    const supabase = createClient()

    // Piezas listas para entrega
    supabase.from('piezas')
      .select('*, siniestro:siniestros(numero_siniestro, placa, taller_origen)')
      .eq('estado', 'LISTO_ENTREGA')
      .order('updated_at', { ascending: false })
      .then(({ data }) => setListosEntrega(data || []))

    // Mis siniestros con filtro
    let query = supabase.from('siniestros')
      .select('*, piezas(id, estado)')
      .eq('responsable_recojo_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (filtro === 'hoy') query = query.eq('fecha_recojo', hoy)
    else if (filtro === 'semana') query = query.gte('fecha_recojo', inicioSemanaStr)
    else if (filtro === 'fecha') query = query.eq('fecha_recojo', fecha)

    query.then(({ data }) => { setMisRegistros(data || []); setLoading(false) })
  }, [profile, filtro, fecha])

  const FILTROS = [
    { key: 'mis', label: 'Todos' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'fecha', label: 'Por fecha' },
  ]

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-syne font-bold text-white">Recojo</h1>
          <p className="text-sm text-[#475569]">{profile?.nombre}</p>
        </div>
        <Link href="/siniestros/nuevo" className="btn-primary">
          <Plus size={16} /> Nuevo
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="text-3xl font-syne font-bold text-green-400">{listosEntrega.length}</p>
          <p className="text-xs text-[#475569] mt-1">Listos para entregar</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-syne font-bold text-[#00D4FF]">{misRegistros.length}</p>
          <p className="text-xs text-[#475569] mt-1">Mis recojos</p>
        </div>
      </div>

      {/* Piezas listas — colapsable */}
      {listosEntrega.length > 0 && (
        <div className="card overflow-hidden">
          <button onClick={() => setMostrarListos(!mostrarListos)}
            className="w-full flex items-center gap-2 p-4 hover:bg-[#131920] transition-colors">
            <Truck size={16} className="text-green-400" />
            <span className="font-syne font-semibold text-white flex-1 text-left">Listas para entregar</span>
            <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full">
              {listosEntrega.length}
            </span>
            {mostrarListos ? <ChevronUp size={16} className="text-[#475569]" /> : <ChevronDown size={16} className="text-[#475569]" />}
          </button>
          {mostrarListos && (
            <div className="px-4 pb-4 space-y-2">
              {listosEntrega.map((p: any) => (
                <Link key={p.id} href={`/scan/${p.id}`}
                  className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl hover:bg-[#1A2332] active:scale-[0.98] transition-all">
                  <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Package size={16} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.nombre}
                      {p.lado !== 'N/A' && <span className="text-[#475569] font-normal"> — {p.lado}</span>}
                    </p>
                    <p className="text-xs text-[#475569] truncate">
                      <span className="font-mono text-[#00D4FF]">{p.siniestro?.numero_siniestro}</span>
                      {' · '}{p.siniestro?.placa}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-green-400 flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mis siniestros */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Mis siniestros</h2>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filtro === f.key
                  ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold'
                  : 'bg-[#131920] text-[#94A3B8] border-[#1E2D42] hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Selector fecha */}
        {filtro === 'fecha' && (
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="input-field" />
        )}

        {/* Lista */}
        {loading ? (
          <div className="card p-8 text-center">
            <div className="w-6 h-6 border-2 border-[#1E2D42] border-t-[#00D4FF] rounded-full animate-spin mx-auto" />
          </div>
        ) : !misRegistros.length ? (
          <div className="card p-8 text-center">
            <p className="text-[#475569] text-sm">No hay recojos en este período</p>
          </div>
        ) : (
          <div className="space-y-2">
            {misRegistros.map((s: any) => {
              const total = s.piezas?.length || 0
              const listo = s.piezas?.filter((p: any) => ['LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length || 0
              const enTraslado = s.piezas?.filter((p: any) => p.estado === 'EN_TRASLADO').length || 0
              return (
                <Link key={s.id} href={`/siniestros/${s.id}`}
                  className="card p-3 flex items-center gap-3 hover:border-[#00D4FF]/30 transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[#00D4FF]">{s.numero_siniestro}</p>
                    <p className="text-xs text-[#475569] truncate">{s.placa} · {s.taller_origen}</p>
                    <p className="text-xs text-[#2D3F55] mt-0.5">{new Date(s.fecha_recojo).toLocaleDateString('es-PE')}</p>
                    {enTraslado > 0 && <p className="text-xs text-blue-400">{enTraslado} en traslado</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-12 bg-[#0D1117] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-green-500"
                        style={{ width: total > 0 ? `${Math.round((listo/total)*100)}%` : '0%' }} />
                    </div>
                    <span className="text-xs text-[#475569]">{listo}/{total}</span>
                    <ChevronRight size={14} className="text-[#2D3F55]" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
