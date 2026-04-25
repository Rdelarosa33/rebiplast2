import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ESTADO_COLOR, ESTADO_LABELS, PiezaEstado } from '@/types'
import { Plus } from 'lucide-react'

const SEGUROS = ['RIMAC','PACIFICO','MAPFRE','LA_POSITIVA','HDI','INTERSEGURO','TALLER']

const ESTADOS_FILTRO: { key: string, label: string, estados: PiezaEstado[] }[] = [
  { key: 'todos', label: 'Todos', estados: [] },
  { key: 'activos', label: 'En proceso', estados: ['EN_TRASLADO','RECIBIDO','ASIGNADO','EN_REPARACION','EN_PREPARACION','EN_PINTURA','EN_PULIDO','CONTROL_CALIDAD'] },
  { key: 'traslado', label: 'En traslado', estados: ['EN_TRASLADO'] },
  { key: 'recibido', label: 'Por ingresar', estados: ['RECIBIDO'] },
  { key: 'reparacion', label: 'En reparación', estados: ['EN_REPARACION','ASIGNADO'] },
  { key: 'pintura', label: 'En pintura', estados: ['EN_PREPARACION','EN_PINTURA','EN_PULIDO'] },
  { key: 'calidad', label: 'Control calidad', estados: ['CONTROL_CALIDAD'] },
  { key: 'listo', label: 'Listo entrega', estados: ['LISTO_ENTREGA'] },
  { key: 'entregado', label: 'Entregado', estados: ['ENTREGADO'] },
]

export default async function SiniestrosPage({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams
  const q = params?.q || ''
  const filtro = params?.filtro || 'todos'
  const seguro = params?.seguro || ''

  const supabase = await createClient()

  // Obtener todos los siniestros con sus piezas
  let query = supabase
    .from('siniestros')
    .select('*, piezas(id, estado)')
    .eq('activo', true)
    .order('created_at', { ascending: false })

  if (q) {
    query = query.or(`numero_siniestro.ilike.%${q}%,placa.ilike.%${q}%,taller_origen.ilike.%${q}%,nombre_asegurado.ilike.%${q}%`)
  }
  if (seguro) {
    query = query.eq('tipo_seguro', seguro)
  }

  const { data: todos } = await query.limit(200)

  // Filtrar por estado de piezas en el cliente
  const filtroConfig = ESTADOS_FILTRO.find(f => f.key === filtro)
  const siniestros = (todos || []).filter(s => {
    if (!filtroConfig || filtroConfig.estados.length === 0) return true
    const piezas = s.piezas || []
    return piezas.some((p: any) => filtroConfig.estados.includes(p.estado))
  })

  // Contar por filtro para los badges
  const conteos: Record<string, number> = {}
  ESTADOS_FILTRO.forEach(f => {
    if (f.estados.length === 0) {
      conteos[f.key] = todos?.length || 0
    } else {
      conteos[f.key] = (todos || []).filter(s =>
        (s.piezas || []).some((p: any) => f.estados.includes(p.estado))
      ).length
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-syne font-bold text-white">Siniestros</h1>
          <p className="text-sm text-[#475569] mt-0.5">{siniestros.length} resultados</p>
        </div>
        <Link href="/siniestros/nuevo" className="btn-primary">
          <Plus size={16} /> Nuevo
        </Link>
      </div>

      {/* Búsqueda */}
      <form>
        <input type="hidden" name="filtro" value={filtro} />
        <input type="hidden" name="seguro" value={seguro} />
        <input name="q" defaultValue={q}
          placeholder="Buscar por siniestro, placa, taller..."
          className="input-field" />
      </form>

      {/* Filtros por estado */}
      <div className="flex gap-2 flex-wrap">
        {ESTADOS_FILTRO.map(f => (
          <Link key={f.key}
            href={`/siniestros?filtro=${f.key}${seguro ? `&seguro=${seguro}` : ''}${q ? `&q=${q}` : ''}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              filtro === f.key
                ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF] font-semibold'
                : 'bg-[#131920] text-[#94A3B8] border-[#1E2D42] hover:border-[#00D4FF]/30 hover:text-white'
            }`}>
            {f.label}
            {conteos[f.key] > 0 && (
              <span className={`ml-1.5 ${filtro === f.key ? 'text-[#080B12]/70' : 'text-[#475569]'}`}>
                {conteos[f.key]}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Filtros por seguro */}
      <div className="flex gap-2 flex-wrap">
        <Link href={`/siniestros?filtro=${filtro}${q ? `&q=${q}` : ''}`}
          className={`text-xs px-3 py-1 rounded-full border transition-all ${
            !seguro ? 'bg-[#7C3AED] text-white border-[#7C3AED] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
          }`}>
          Todos los seguros
        </Link>
        {SEGUROS.map(s => (
          <Link key={s}
            href={`/siniestros?filtro=${filtro}&seguro=${s}${q ? `&q=${q}` : ''}`}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${
              seguro === s ? 'bg-[#7C3AED] text-white border-[#7C3AED] font-semibold' : 'bg-[#131920] text-[#475569] border-[#1E2D42] hover:text-white'
            }`}>
            {s}
          </Link>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {siniestros.map(s => {
          const total = s.piezas?.length || 0
          const listo = s.piezas?.filter((p: any) => ['LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length || 0
          const estadosUnicos = Array.from(new Set(s.piezas?.map((p: any) => p.estado))) as PiezaEstado[]

          return (
            <Link key={s.id} href={`/siniestros/${s.id}`}
              className="card p-4 block hover:border-[#00D4FF]/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-[#00D4FF]">{s.numero_siniestro}</span>
                    <span className="text-xs text-[#475569]">•</span>
                    <span className="font-mono text-sm text-white">{s.placa}</span>
                    {s.marca && <span className="text-xs text-[#475569]">{s.marca}</span>}
                    <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">
                      {s.tipo_seguro}
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] mt-1 truncate">{s.taller_origen}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {estadosUnicos.slice(0, 4).map(e => (
                      <span key={e} className={`badge ${ESTADO_COLOR[e]}`}>{ESTADO_LABELS[e]}</span>
                    ))}
                    {estadosUnicos.length > 4 && (
                      <span className="badge bg-[#131920] border-[#1E2D42] text-[#475569]">+{estadosUnicos.length - 4}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 bg-[#131920] rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-green-500"
                        style={{ width: total > 0 ? `${Math.round((listo/total)*100)}%` : '0%' }} />
                    </div>
                    <span className="text-xs text-[#475569]">{listo}/{total}</span>
                  </div>
                  <p className="text-xs text-[#475569] mt-1">
                    {new Date(s.fecha_recojo).toLocaleDateString('es-PE')}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
        {siniestros.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-[#475569]">No se encontraron siniestros</p>
          </div>
        )}
      </div>
    </div>
  )
}
