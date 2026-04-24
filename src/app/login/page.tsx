'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Wrench, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'

const DEMO_USERS = [
  { role: 'admin', email: 'admin@taller.com', label: 'Admin', color: 'text-red-400' },
  { role: 'recojo', email: 'recojo@taller.com', label: 'Recojo', color: 'text-blue-400' },
  { role: 'supervisor', email: 'supervisor@taller.com', label: 'Supervisor', color: 'text-purple-400' },
  { role: 'reparacion', email: 'reparacion@taller.com', label: 'Reparación', color: 'text-amber-400' },
  { role: 'preparacion', email: 'preparacion@taller.com', label: 'Preparación', color: 'text-orange-400' },
  { role: 'pintura', email: 'pintura@taller.com', label: 'Pintura', color: 'text-pink-400' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('Correo o contraseña incorrectos')
        setLoading(false)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080B12] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D4FF] to-[#7C3AED] flex items-center justify-center mx-auto mb-4">
            <Wrench size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-syne font-bold text-white">
            Rebiplast<span className="text-[#00D4FF]">PRO</span>
          </h1>
          <p className="text-sm text-[#475569] mt-1">Sistema de gestión de siniestros</p>
        </div>

        {/* Form */}
        <div className="card p-6">
          <h2 className="font-syne font-semibold text-white mb-5">Iniciar sesión</h2>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 mb-4">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input-field" placeholder="usuario@taller.com" required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pr-10" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-white">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#080B12]/30 border-t-[#080B12] rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Ingresar <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Demo access */}
        <div className="card p-4">
          <p className="text-xs font-semibold text-[#2D3F55] uppercase tracking-wider mb-3">Acceso rápido demo</p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map(u => (
              <button key={u.role} onClick={() => { setEmail(u.email); setPassword('taller2024') }}
                className="text-xs bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] rounded-lg px-2 py-2 transition-all">
                <span className={u.color + ' font-medium'}>{u.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-[#2D3F55] mt-2 text-center">Contraseña: taller2024</p>
        </div>

      </div>
    </div>
  )
}
