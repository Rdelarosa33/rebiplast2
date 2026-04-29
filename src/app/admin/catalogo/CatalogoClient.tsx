'use client'

import { useState, useTransition } from 'react'
import { Plus, Search, Edit2, EyeOff, Eye, X, Check, AlertCircle, Wrench, User, Package } from 'lucide-react'
import {
  crearTaller, editarTaller, desactivarTaller, activarTaller,
  crearGirador, editarGirador, desactivarGirador, activarGirador,
  crearPieza, editarPieza, desactivarPieza, activarPieza,
} from './actions'

type Taller = { id: number; nombre: string; alias: string[] | null; activo: boolean }
type Girador = { id: number; nombre: string; aseguradora: string; alias: string[] | null; activo: boolean }
type Pieza = { id: number; sigla: string; nombre_completo: string; alias: string[] | null; activo: boolean }

const ASEGURADORAS = ['MAPFRE', 'RIMAC', 'PACIFICO', 'LA_POSITIVA', 'INTERSEGURO']

function normalizar(t: string) {
  return (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export default function CatalogoClient({
  talleres, giradores, piezas,
}: {
  talleres: Taller[]
  giradores: Girador[]
  piezas: Pieza[]
}) {
  const [tab, setTab] = useState<'talleres' | 'giradores' | 'piezas'>('talleres')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  return (
    <div className="container max-w-5xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Gestión de Catálogo</h1>
        <p className="text-sm text-[#94A3B8]">Talleres, giradores y piezas para uso del OCR</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1E2D42]">
        <TabButton active={tab === 'talleres'} onClick={() => setTab('talleres')} icon={<Wrench size={14} />} label={`Talleres (${talleres.length})`} />
        <TabButton active={tab === 'giradores'} onClick={() => setTab('giradores')} icon={<User size={14} />} label={`Giradores (${giradores.length})`} />
        <TabButton active={tab === 'piezas'} onClick={() => setTab('piezas')} icon={<Package size={14} />} label={`Piezas (${piezas.length})`} />
      </div>

      {/* Buscador + filtros */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            className="input-field pl-9"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <button
          onClick={() => setMostrarInactivos(!mostrarInactivos)}
          className={`px-3 py-2 rounded-xl text-xs border transition-colors ${
            mostrarInactivos
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-[#0D1117] border-[#1E2D42] text-[#94A3B8]'
          }`}
        >
          {mostrarInactivos ? 'Ocultar' : 'Ver'} inactivos
        </button>
      </div>

      {tab === 'talleres' && (
        <PanelTalleres talleres={talleres} busqueda={busqueda} mostrarInactivos={mostrarInactivos} />
      )}
      {tab === 'giradores' && (
        <PanelGiradores giradores={giradores} busqueda={busqueda} mostrarInactivos={mostrarInactivos} />
      )}
      {tab === 'piezas' && (
        <PanelPiezas piezas={piezas} busqueda={busqueda} mostrarInactivos={mostrarInactivos} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-sm px-4 py-2 transition-colors ${
        active ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]' : 'text-[#475569] hover:text-[#94A3B8]'
      }`}
    >
      {icon}{label}
    </button>
  )
}

// ──────────────────────────────────────────────────────
// TALLERES
// ──────────────────────────────────────────────────────
function PanelTalleres({ talleres, busqueda, mostrarInactivos }: { talleres: Taller[]; busqueda: string; mostrarInactivos: boolean }) {
  const [modal, setModal] = useState<{ tipo: 'nuevo' | 'editar'; data?: Taller } | null>(null)
  const bNorm = normalizar(busqueda)

  const filtrados = talleres.filter(t => {
    if (!mostrarInactivos && !t.activo) return false
    if (!bNorm) return true
    const enNombre = normalizar(t.nombre).includes(bNorm)
    const enAlias = (t.alias || []).some(a => normalizar(a).includes(bNorm))
    return enNombre || enAlias
  })

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <p className="text-xs text-[#475569]">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setModal({ tipo: 'nuevo' })} className="btn-primary flex items-center gap-1 text-xs">
          <Plus size={14} /> Agregar taller
        </button>
      </div>

      <div className="space-y-2">
        {filtrados.map(t => (
          <ItemTaller key={t.id} taller={t} onEditar={() => setModal({ tipo: 'editar', data: t })} />
        ))}
        {filtrados.length === 0 && (
          <p className="text-xs text-[#475569] text-center py-8">Sin resultados</p>
        )}
      </div>

      {modal && (
        <ModalTaller
          taller={modal.data}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function ItemTaller({ taller, onEditar }: { taller: Taller; onEditar: () => void }) {
  const [pending, startTransition] = useTransition()
  const toggleActivo = () => {
    startTransition(async () => {
      try {
        if (taller.activo) await desactivarTaller(taller.id)
        else await activarTaller(taller.id)
      } catch (e: any) { alert(e.message) }
    })
  }

  return (
    <div className={`bg-[#0D1117] border rounded-xl p-3 ${taller.activo ? 'border-[#1E2D42]' : 'border-amber-500/30 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-white truncate">{taller.nombre}</p>
            {!taller.activo && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">INACTIVO</span>}
          </div>
          {taller.alias && taller.alias.length > 0 && (
            <p className="text-[10px] text-[#475569] mt-1">Alias: {taller.alias.join(', ')}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEditar} className="p-2 hover:bg-[#131920] rounded text-[#94A3B8] hover:text-[#00D4FF]" title="Editar">
            <Edit2 size={14} />
          </button>
          <button onClick={toggleActivo} disabled={pending} className="p-2 hover:bg-[#131920] rounded text-[#94A3B8] hover:text-amber-400 disabled:opacity-50"
            title={taller.activo ? 'Desactivar' : 'Activar'}>
            {taller.activo ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalTaller({ taller, onClose }: { taller?: Taller; onClose: () => void }) {
  const [nombre, setNombre] = useState(taller?.nombre || '')
  const [aliasStr, setAliasStr] = useState((taller?.alias || []).join(', '))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const guardar = () => {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    const aliases = aliasStr.split(',').map(s => s.trim()).filter(Boolean)
    startTransition(async () => {
      try {
        if (taller) await editarTaller(taller.id, nombre, aliases)
        else await crearTaller(nombre, aliases)
        onClose()
      } catch (e: any) { setError(e.message) }
    })
  }

  return (
    <ModalShell title={taller ? 'Editar taller' : 'Nuevo taller'} onClose={onClose}>
      <Field label="Nombre">
        <input className="input-field" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Toyo Service" />
      </Field>
      <Field label="Aliases (separados por coma)" hint="Otros nombres con los que se conoce. Ej: TOYO SAN MIGUEL, TOYO SM">
        <input className="input-field" value={aliasStr} onChange={e => setAliasStr(e.target.value)} placeholder="TOYO, TOYO SM" />
      </Field>
      <FooterModal error={error} pending={pending} onCancelar={onClose} onGuardar={guardar} />
    </ModalShell>
  )
}

// ──────────────────────────────────────────────────────
// GIRADORES
// ──────────────────────────────────────────────────────
function PanelGiradores({ giradores, busqueda, mostrarInactivos }: { giradores: Girador[]; busqueda: string; mostrarInactivos: boolean }) {
  const [modal, setModal] = useState<{ tipo: 'nuevo' | 'editar'; data?: Girador } | null>(null)
  const [filtroAseg, setFiltroAseg] = useState<string>('')
  const bNorm = normalizar(busqueda)

  const filtrados = giradores.filter(g => {
    if (!mostrarInactivos && !g.activo) return false
    if (filtroAseg && g.aseguradora !== filtroAseg) return false
    if (!bNorm) return true
    return normalizar(g.nombre).includes(bNorm) || (g.alias || []).some(a => normalizar(a).includes(bNorm))
  })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <button onClick={() => setFiltroAseg('')}
          className={`text-[10px] px-2 py-1 rounded border ${!filtroAseg ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/50' : 'bg-[#0D1117] text-[#94A3B8] border-[#1E2D42]'}`}>
          Todas
        </button>
        {ASEGURADORAS.map(a => (
          <button key={a} onClick={() => setFiltroAseg(a)}
            className={`text-[10px] px-2 py-1 rounded border ${filtroAseg === a ? 'bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/50' : 'bg-[#0D1117] text-[#94A3B8] border-[#1E2D42]'}`}>
            {a}
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <p className="text-xs text-[#475569]">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setModal({ tipo: 'nuevo' })} className="btn-primary flex items-center gap-1 text-xs">
          <Plus size={14} /> Agregar girador
        </button>
      </div>

      <div className="space-y-2">
        {filtrados.map(g => (
          <ItemGirador key={g.id} girador={g} onEditar={() => setModal({ tipo: 'editar', data: g })} />
        ))}
        {filtrados.length === 0 && <p className="text-xs text-[#475569] text-center py-8">Sin resultados</p>}
      </div>

      {modal && <ModalGirador girador={modal.data} onClose={() => setModal(null)} />}
    </div>
  )
}

function ItemGirador({ girador, onEditar }: { girador: Girador; onEditar: () => void }) {
  const [pending, startTransition] = useTransition()
  const toggle = () => startTransition(async () => {
    try {
      if (girador.activo) await desactivarGirador(girador.id)
      else await activarGirador(girador.id)
    } catch (e: any) { alert(e.message) }
  })

  return (
    <div className={`bg-[#0D1117] border rounded-xl p-3 ${girador.activo ? 'border-[#1E2D42]' : 'border-amber-500/30 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-white truncate">{girador.nombre}</p>
            <span className="text-[9px] bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30 px-1.5 py-0.5 rounded">{girador.aseguradora}</span>
            {!girador.activo && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">INACTIVO</span>}
          </div>
          {girador.alias && girador.alias.length > 0 && (
            <p className="text-[10px] text-[#475569] mt-1">Alias: {girador.alias.join(', ')}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEditar} className="p-2 hover:bg-[#131920] rounded text-[#94A3B8] hover:text-[#00D4FF]" title="Editar"><Edit2 size={14} /></button>
          <button onClick={toggle} disabled={pending} className="p-2 hover:bg-[#131920] rounded text-[#94A3B8] hover:text-amber-400 disabled:opacity-50"
            title={girador.activo ? 'Desactivar' : 'Activar'}>
            {girador.activo ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalGirador({ girador, onClose }: { girador?: Girador; onClose: () => void }) {
  const [nombre, setNombre] = useState(girador?.nombre || '')
  const [aseguradora, setAseguradora] = useState(girador?.aseguradora || 'MAPFRE')
  const [aliasStr, setAliasStr] = useState((girador?.alias || []).join(', '))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const guardar = () => {
    setError(null)
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    const aliases = aliasStr.split(',').map(s => s.trim()).filter(Boolean)
    startTransition(async () => {
      try {
        if (girador) await editarGirador(girador.id, nombre, aseguradora, aliases)
        else await crearGirador(nombre, aseguradora, aliases)
        onClose()
      } catch (e: any) { setError(e.message) }
    })
  }

  return (
    <ModalShell title={girador ? 'Editar girador' : 'Nuevo girador'} onClose={onClose}>
      <Field label="Nombre">
        <input className="input-field" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Luis Tapia" />
      </Field>
      <Field label="Aseguradora">
        <select className="input-field" value={aseguradora} onChange={e => setAseguradora(e.target.value)}>
          {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </Field>
      <Field label="Aliases (separados por coma)" hint="Apellido suelto, abreviatura, etc. Ej: TAPIA, L. TAPIA">
        <input className="input-field" value={aliasStr} onChange={e => setAliasStr(e.target.value)} placeholder="TAPIA, L. TAPIA" />
      </Field>
      <FooterModal error={error} pending={pending} onCancelar={onClose} onGuardar={guardar} />
    </ModalShell>
  )
}

// ──────────────────────────────────────────────────────
// PIEZAS
// ──────────────────────────────────────────────────────
function PanelPiezas({ piezas, busqueda, mostrarInactivos }: { piezas: Pieza[]; busqueda: string; mostrarInactivos: boolean }) {
  const [modal, setModal] = useState<{ tipo: 'nuevo' | 'editar'; data?: Pieza } | null>(null)
  const bNorm = normalizar(busqueda)

  const filtrados = piezas.filter(p => {
    if (!mostrarInactivos && !p.activo) return false
    if (!bNorm) return true
    return normalizar(p.sigla).includes(bNorm) ||
      normalizar(p.nombre_completo).includes(bNorm) ||
      (p.alias || []).some(a => normalizar(a).includes(bNorm))
  })

  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <p className="text-xs text-[#475569]">{filtrados.length} resultado{filtrados.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setModal({ tipo: 'nuevo' })} className="btn-primary flex items-center gap-1 text-xs">
          <Plus size={14} /> Agregar pieza
        </button>
      </div>

      <div className="space-y-2">
        {filtrados.map(p => (
          <ItemPieza key={p.id} pieza={p} onEditar={() => setModal({ tipo: 'editar', data: p })} />
        ))}
        {filtrados.length === 0 && <p className="text-xs text-[#475569] text-center py-8">Sin resultados</p>}
      </div>

      {modal && <ModalPieza pieza={modal.data} onClose={() => setModal(null)} />}
    </div>
  )
}

function ItemPieza({ pieza, onEditar }: { pieza: Pieza; onEditar: () => void }) {
  const [pending, startTransition] = useTransition()
  const toggle = () => startTransition(async () => {
    try {
      if (pieza.activo) await desactivarPieza(pieza.id)
      else await activarPieza(pieza.id)
    } catch (e: any) { alert(e.message) }
  })

  return (
    <div className={`bg-[#0D1117] border rounded-xl p-3 ${pieza.activo ? 'border-[#1E2D42]' : 'border-amber-500/30 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-[#00D4FF] font-bold truncate">{pieza.sigla}</p>
            <p className="text-xs text-white truncate">{pieza.nombre_completo}</p>
            {!pieza.activo && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">INACTIVO</span>}
          </div>
          {pieza.alias && pieza.alias.length > 0 && (
            <p className="text-[10px] text-[#475569] mt-1">Alias: {pieza.alias.join(', ')}</p>
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEditar} className="p-2 hover:bg-[#131920] rounded text-[#94A3B8] hover:text-[#00D4FF]" title="Editar"><Edit2 size={14} /></button>
          <button onClick={toggle} disabled={pending} className="p-2 hover:bg-[#131920] rounded text-[#94A3B8] hover:text-amber-400 disabled:opacity-50"
            title={pieza.activo ? 'Desactivar' : 'Activar'}>
            {pieza.activo ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalPieza({ pieza, onClose }: { pieza?: Pieza; onClose: () => void }) {
  const [sigla, setSigla] = useState(pieza?.sigla || '')
  const [nombre, setNombre] = useState(pieza?.nombre_completo || '')
  const [aliasStr, setAliasStr] = useState((pieza?.alias || []).join(', '))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const guardar = () => {
    setError(null)
    if (!sigla.trim()) { setError('La sigla es obligatoria'); return }
    if (!nombre.trim()) { setError('El nombre completo es obligatorio'); return }
    const aliases = aliasStr.split(',').map(s => s.trim()).filter(Boolean)
    startTransition(async () => {
      try {
        if (pieza) await editarPieza(pieza.id, sigla, nombre, aliases)
        else await crearPieza(sigla, nombre, aliases)
        onClose()
      } catch (e: any) { setError(e.message) }
    })
  }

  return (
    <ModalShell title={pieza ? 'Editar pieza' : 'Nueva pieza'} onClose={onClose}>
      <Field label="Sigla del taller" hint="Código corto que usa el taller. Ej: FUNDA DELT, FARO DD">
        <input className="input-field font-mono uppercase" value={sigla} onChange={e => setSigla(e.target.value.toUpperCase())} placeholder="FUNDA DELT" />
      </Field>
      <Field label="Nombre completo" hint="Nombre formal de la pieza. Ej: FUNDA DELANTERA, FARO DELANTERO DERECHO">
        <input className="input-field uppercase" value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())} placeholder="FUNDA DELANTERA" />
      </Field>
      <Field label="Aliases (separados por coma)" hint="Otras formas como las aseguradoras la nombran. Ej: PARACHOQUE DELANTERO, PARACHQ DLT">
        <input className="input-field uppercase" value={aliasStr} onChange={e => setAliasStr(e.target.value.toUpperCase())} placeholder="PARACHOQUE DELANTERO, PARACHQ DLT" />
      </Field>
      <FooterModal error={error} pending={pending} onCancelar={onClose} onGuardar={guardar} />
    </ModalShell>
  )
}

// ──────────────────────────────────────────────────────
// COMPONENTES COMUNES
// ──────────────────────────────────────────────────────
function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0D1117] border border-[#1E2D42] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#1E2D42]">
          <h2 className="font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-[#475569] hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#475569] mt-1">{hint}</p>}
    </div>
  )
}

function FooterModal({ error, pending, onCancelar, onGuardar }: { error: string | null; pending: boolean; onCancelar: () => void; onGuardar: () => void }) {
  return (
    <>
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
          <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button onClick={onCancelar} className="flex-1 px-4 py-2 bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-white rounded-lg text-sm">
          Cancelar
        </button>
        <button onClick={onGuardar} disabled={pending} className="flex-1 btn-primary text-sm flex items-center justify-center gap-1 disabled:opacity-50">
          <Check size={14} /> {pending ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </>
  )
}
