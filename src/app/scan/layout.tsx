'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, ROLE_LABELS, ROLE_COLOR } from '@/types'
import {
  LayoutDashboard, ClipboardList, QrCode, Users, UserCog,
  LogOut, Wrench, ShieldCheck, Hammer, Package,
  ChevronLeft, ChevronRight, X, Menu
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const [puedeRecoger, setPuedeRecoger] = useState(
    profile?.role === 'recojo' || profile?.role === 'admin' || profile?.role === 'supervisor'
  )

  useEffect(() => {
    if (profile?.role !== 'trabajador') return
    const supabase = createClient()
    const hoy = new Date().toISOString().split('T')[0]
    supabase.from('habilitaciones_recojo')
      .select('id').eq('trabajador_id', profile.id).eq('fecha', hoy).maybeSingle()
      .then(({ data }) => setPuedeRecoger(!!data))
  }, [profile?.id, profile?.role])

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
    ...(profile?.role === 'admin' || profile?.role === 'supervisor' || profile?.role === 'recojo' || profile?.role === 'recojo_trabajador'
      ? [{ href: '/siniestros', icon: ClipboardList, label: 'Siniestros' }]
      : []),
    { href: '/scan', icon: QrCode, label: 'Escanear' },
    ...(['trabajador','recojo_trabajador'].includes(profile?.role || '')
      ? [{ href: '/trabajador', icon: Hammer, label: 'Mis Piezas' }]
      : []),
    ...(puedeRecoger
      ? [{ href: '/siniestros/nuevo', icon: Package, label: 'Recojo' }]
      : []),
    ...(profile?.role === 'admin'
      ? [{ href: '/admin', icon: Users, label: 'Admin' }, { href: '/admin/usuarios', icon: UserCog, label: 'Usuarios' }]
      : []),
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-[#080B12]">

      {/* ========================================
          DESKTOP SIDEBAR (lg+)
          ======================================== */}
      <aside className={`
        hidden lg:flex flex-col bg-[#0D1117] border-r border-[#1E2D42] flex-shrink-0
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-60'}
      `}>
        {/* Logo */}
        <div className={`p-4 border-b border-[#1E2D42] flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#7C3AED] flex items-center justify-center flex-shrink-0">
                <Wrench size={15} className="text-white" />
              </div>
              <div>
                <p className="font-syne font-bold text-white text-sm">RebiplastPRO</p>
                <p className="text-xs text-[#475569]">Gestión de siniestros</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#7C3AED] flex items-center justify-center">
              <Wrench size={15} className="text-white" />
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)}
            className="text-[#475569] hover:text-white transition-colors ml-1 flex-shrink-0">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link key={item.href} href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all
                  ${collapsed ? 'justify-center' : ''}
                  ${active ? 'bg-[#131920] text-white' : 'text-[#94A3B8] hover:bg-[#131920] hover:text-white'}
                `}>
                <item.icon size={18} className="flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        {profile && (
          <div className="p-2 border-t border-[#1E2D42]">
            {collapsed ? (
              <button onClick={handleLogout} title="Cerrar sesión"
                className="w-full flex justify-center p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
                <LogOut size={18} />
              </button>
            ) : (
              <div className="bg-[#131920] rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1A2332] flex items-center justify-center text-xs font-bold text-[#00D4FF] flex-shrink-0">
                  {profile.nombre[0]}{profile.apellido?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{profile.nombre}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-md ${ROLE_COLOR[profile.role]}`}>
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>
                <button onClick={handleLogout} title="Cerrar sesión"
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors flex-shrink-0">
                  <LogOut size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ========================================
          MOBILE OVERLAY MENU (< lg)
          ======================================== */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-[#0D1117] border-r border-[#1E2D42] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#1E2D42]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00D4FF] to-[#7C3AED] flex items-center justify-center">
                  <Wrench size={15} className="text-white" />
                </div>
                <span className="font-syne font-bold text-white">RebiplastPRO</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-[#475569] hover:text-white">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all
                      ${active ? 'bg-[#131920] text-white' : 'text-[#94A3B8] hover:bg-[#131920] hover:text-white'}
                    `}>
                    <item.icon size={20} className="flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            {profile && (
              <div className="p-3 border-t border-[#1E2D42]">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-[#1A2332] flex items-center justify-center text-sm font-bold text-[#00D4FF]">
                    {profile.nombre[0]}{profile.apellido?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{profile.nombre} {profile.apellido}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md ${ROLE_COLOR[profile.role]}`}>
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </div>
                  <button onClick={handleLogout}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ========================================
          MAIN CONTENT
          ======================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0D1117] border-b border-[#1E2D42] flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#131920] transition-all">
            <Menu size={20} />
          </button>
          <span className="font-syne font-bold text-white text-sm">RebiplastPRO</span>
          {profile && (
            <div className="flex items-center gap-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLOR[profile.role]}`}>
                {profile.nombre}
              </span>
            </div>
          )}
        </header>

        {/* Page content - extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>

        {/* ========================================
            MOBILE BOTTOM NAV (< lg)
            ======================================== */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0D1117] border-t border-[#1E2D42] z-40 safe-area-bottom">
          <div className={`flex items-center justify-around px-1 py-1 ${navItems.length > 4 ? 'gap-0' : 'gap-2'}`}>
            {navItems.slice(0, 5).map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link key={item.href} href={item.href}
                  className={`flex flex-col items-center gap-0.5 flex-1 py-2 px-1 rounded-xl transition-all
                    ${active ? 'text-[#00D4FF]' : 'text-[#475569]'}
                  `}>
                  <item.icon size={21} />
                  <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                </Link>
              )
            })}
            {/* Si hay más de 5 items, mostrar "Más" */}
            {navItems.length > 5 && (
              <button onClick={() => setMobileOpen(true)}
                className="flex flex-col items-center gap-0.5 flex-1 py-2 px-1 text-[#475569]">
                <Menu size={21} />
                <span className="text-[10px] font-medium">Más</span>
              </button>
            )}
          </div>
        </nav>

      </div>
    </div>
  )
}
