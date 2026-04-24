import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/actions'
import { ESTADO_COLOR, ESTADO_LABELS } from '@/types'
import Link from 'next/link'
import { Plus, ClipboardList, Package, Truck, ChevronRight } from 'lucide-react'

export default async function DashboardRecojo({ searchParams }: { searchParams?: any }) {
  const supabase = await createClient()
  const profile = await getCurrentUser()
  const filtro = searchParams?.filtro || 'mis'

  // Fecha de hoy y semana
  const hoy = new Date().toISOString().split('T')[0]
  const inicioSemana = new Date()
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
  const inicioSemanaStr = inicioSemana.toISOString().split('T')[0]
  const fechaFiltro = searchParams?.fecha || ''

  // Piezas listas para entrega (todas, no solo las suyas)
  const { data: listosEntrega } = await supabase
    .from('piezas')
    .select('*, siniestro:siniestros(numero_siniestro, placa, taller_origen, tipo_seguro)')
    .eq('estado', 'LISTO_ENTREGA')
    .order('updated_at', { ascending: false })

  // Mis siniestros con filtro
  let query = supabase
    .from('siniestros')
    .select('*, piezas(id, estado)')
    .eq('responsable_recojo_id', profile?.id)
    .order('created_at', { ascending: false })

  if (filtro === 'hoy') {
    query = query.eq('fecha_recojo', hoy)
  } else if (filtro === 'semana') {
    query = query.gte('fecha_recojo', inicioSemanaStr)
  } else if (filtro === 'fecha' && fechaFiltro) {
    query = query.eq('fecha_recojo', fechaFiltro)
  }

  const { data: misRegistros } = await query.limit(30)

  const FILTROS = [
    { key: 'mis', label: 'Mis recojos' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'semana', label: 'Esta semana' },
    { key: 'fecha', label: 'Por fecha' },
  ]

  return (
    <div className="space-y-5 max-w-lg mx-auto">
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
          <p className="text-3xl font-syne font-bold text-green-400">{listosEntrega?.length || 0}</p>
          <p className="text-xs text-[#475569] mt-1">Listos para entregar</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-syne font-bold text-[#00D4FF]">{misRegistros?.length || 0}</p>
          <p className="text-xs text-[#475569] mt-1">Mis recojos</p>
        </div>
      </div>

      {/* Piezas listas para entrega */}
      {listosEntrega && listosEntrega.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={16} className="text-green-400" />
            <h2 className="font-syne font-semibold text-white">Listas para entregar</h2>
            <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-2 py-0.5 rounded-full ml-auto">
              {listosEntrega.length}
            </span>
          </div>
          <div className="space-y-2">
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
                    {' · '}{p.siniestro?.placa}{' · '}{p.siniestro?.taller_origen}
                  </p>
                </div>
                <ChevronRight size={16} className="text-green-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={16} className="text-[#00D4FF]" />
          <h2 className="font-syne font-semibold text-white">Mis siniestros</h2>
        </div>

        {/* Botones filtro */}
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(f => (
            <Link key={f.key}
              href={`/dashboard?filtro=${f.key}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                filtro === f.key
                  ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold'
                  : 'bg-[#131920] text-[#94A3B8] border-[#1E2D42] hover:text-white'
              }`}>
              {f.label}
            </Link>
          ))}
        </div>

        {/* Input fecha específica */}
        {filtro === 'fecha' && (
          <form>
            <input type="hidden" name="filtro" value="fecha" />
            <input type="date" name="fecha" defaultValue={fechaFiltro || hoy}
              className="input-field"
              onChange={e => window.location.href = `/dashboard?filtro=fecha&fecha=${e.target.value}`} />
          </form>
        )}

        {/* Lista */}
        {!misRegistros?.length ? (
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
                  className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl hover:bg-[#1A2332] transition-all card">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[#00D4FF]">{s.numero_siniestro}</p>
                    <p className="text-xs text-[#475569] truncate">{s.placa} · {s.taller_origen}</p>
                    <p className="text-xs text-[#2D3F55] mt-0.5">{new Date(s.fecha_recojo).toLocaleDateString('es-PE')}</p>
                    {enTraslado > 0 && (
                      <p className="text-xs text-blue-400 mt-0.5">{enTraslado} en traslado</p>
                    )}
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
