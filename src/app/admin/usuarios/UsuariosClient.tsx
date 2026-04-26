'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, Plus, Edit2, Power, X, Check, ChevronDown } from 'lucide-react'
import { ROLE_LABELS, ROLE_COLOR, UserRole } from '@/types'

const ROLES: UserRole[] = ['admin', 'supervisor', 'trabajador', 'recojo']

interface Usuario {
  id: string
  nombre: string
  apellido: string
  email: string
  role: UserRole
  activo: boolean
}

export default function UsuariosClient({ usuarios }: { usuarios: Usuario[] }) {
  const [lista, setLista] = useState(usuarios)
  const [modalAgregar, setModalAgregar] = useState(false)
  const [modalEditar, setModalEditar] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form agregar
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoApellido, setNuevoApellido] = useState('')
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevoRol, setNuevoRol] = useState<UserRole>('trabajador')
  const [nuevoPassword, setNuevoPassword] = useState('')

  // Form editar
  const [editNombre, setEditNombre] = useState('')
  const [editApellido, setEditApellido] = useState('')
  const [editRol, setEditRol] = useState<UserRole>('trabajador')
  const [editPassword, setEditPassword] = useState('')

  const abrirEditar = (u: Usuario) => {
    setModalEditar(u)
    setEditNombre(u.nombre)
    setEditApellido(u.apellido)
    setEditRol(u.role)
    setEditPassword('')
    setError('')
  }

  const toggleActivo = async (u: Usuario) => {
    const supabase = createClient()
    const { error } = await supabase.from('profiles')
      .update({ activo: !u.activo })
      .eq('id', u.id)
    if (!error) {
      setLista(prev => prev.map(w => w.id === u.id ? { ...w, activo: !w.activo } : w))
    }
  }

  const guardarEdicion = async () => {
    if (!modalEditar || !editNombre) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/crear-usuario', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: modalEditar.id,
        nombre: editNombre,
        apellido: editApellido,
        role: editRol,
        ...(editPassword ? { password: editPassword } : {})
      })
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setLista(prev => prev.map(w => w.id === modalEditar.id
        ? { ...w, nombre: editNombre, apellido: editApellido, role: editRol }
        : w))
      setModalEditar(null)
    }
    setLoading(false)
  }

  const agregarUsuario = async () => {
    if (!nuevoNombre || !nuevoEmail || !nuevoPassword) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: nuevoNombre, apellido: nuevoApellido, email: nuevoEmail, password: nuevoPassword, role: nuevoRol })
    })
    const data = await res.json()

    if (data.error) {
      setError(data.error)
    } else {
      setLista(prev => [...prev, data.usuario])
      setModalAgregar(false)
      setNuevoNombre(''); setNuevoApellido(''); setNuevoEmail(''); setNuevoPassword(''); setNuevoRol('trabajador')
    }
    setLoading(false)
  }

  const rolColor: Record<UserRole, string> = {
    admin: 'bg-red-500/20 text-red-300 border-red-500/30',
    supervisor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    trabajador: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    recojo: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    recojo_trabajador: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    owner: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-[#00D4FF]" />
          <h1 className="text-2xl font-syne font-bold text-white">Usuarios</h1>
          <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full">{lista.length}</span>
        </div>
        <button onClick={() => { setModalAgregar(true); setError('') }}
          className="flex items-center gap-2 bg-[#00D4FF] text-[#080B12] font-semibold px-4 py-2 rounded-xl text-sm">
          <Plus size={16} />
          Agregar
        </button>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {lista.map(u => (
          <div key={u.id} className={`card p-4 flex items-center gap-3 ${!u.activo ? 'opacity-50' : ''}`}>
            <div className="w-10 h-10 rounded-xl bg-[#131920] flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-[#00D4FF]">{u.nombre?.[0]}{u.apellido?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{u.nombre} {u.apellido}</p>
              <p className="text-xs text-[#475569]">{u.email}</p>
              <div className="flex gap-2 mt-1">
                <span className={`text-xs badge ${rolColor[u.role] || 'bg-[#131920] text-[#475569] border-[#1E2D42]'}`}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
                {!u.activo && <span className="text-xs badge bg-red-500/20 text-red-300 border-red-500/30">Inactivo</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => abrirEditar(u)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#131920] text-[#475569] hover:text-white transition-colors">
                <Edit2 size={14} />
              </button>
              <button onClick={() => toggleActivo(u)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  u.activo ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                }`}>
                <Power size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Agregar */}
      {modalAgregar && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="card p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-syne font-bold text-white">Nuevo usuario</h3>
              <button onClick={() => setModalAgregar(false)} className="text-[#475569] hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Nombre *</label>
                  <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} className="input-field" placeholder="Juan" />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input value={nuevoApellido} onChange={e => setNuevoApellido(e.target.value)} className="input-field" placeholder="Pérez" />
                </div>
              </div>
              <div>
                <label className="label">Email *</label>
                <input value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} className="input-field" placeholder="juan@rebiplast.pe" type="email" />
              </div>
              <div>
                <label className="label">Contraseña temporal *</label>
                <input value={nuevoPassword} onChange={e => setNuevoPassword(e.target.value)} className="input-field" placeholder="Rebiplast2024" type="text" />
              </div>
              <div>
                <label className="label">Rol *</label>
                <div className="relative">
                  <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value as UserRole)}
                    className="input-field appearance-none pr-8">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalAgregar(false)} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={agregarUsuario} disabled={loading || !nuevoNombre || !nuevoEmail || !nuevoPassword}
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                {loading ? '...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="card p-5 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-syne font-bold text-white">Editar usuario</h3>
              <button onClick={() => setModalEditar(null)} className="text-[#475569] hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Nombre *</label>
                  <input value={editNombre} onChange={e => setEditNombre(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label">Apellido</label>
                  <input value={editApellido} onChange={e => setEditApellido(e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label">Rol *</label>
                <div className="relative">
                  <select value={editRol} onChange={e => setEditRol(e.target.value as UserRole)}
                    className="input-field appearance-none pr-8">
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="label">Nueva contraseña (opcional)</label>
                <input value={editPassword} onChange={e => setEditPassword(e.target.value)}
                  className="input-field" placeholder="Dejar vacío para no cambiar" type="text" />
              </div>
              <p className="text-xs text-[#475569]">Email: {modalEditar.email}</p>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalEditar(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={guardarEdicion} disabled={loading || !editNombre}
                className="btn-primary flex-1 justify-center disabled:opacity-50">
                {loading ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
