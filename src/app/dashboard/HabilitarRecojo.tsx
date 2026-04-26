'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Car, Check } from 'lucide-react'

interface Trabajador {
  id: string
  nombre: string
  apellido: string
  habilitado: boolean
}

export default function HabilitarRecojo({ trabajadores, supervisorId }: { trabajadores: Trabajador[], supervisorId: string }) {
  const [lista, setLista] = useState(trabajadores)
  const [loading, setLoading] = useState<string | null>(null)

  const toggle = async (t: Trabajador) => {
    setLoading(t.id)
    const supabase = createClient()
    const hoy = new Date().toISOString().split('T')[0]

    if (t.habilitado) {
      await supabase.from('habilitaciones_recojo')
        .delete()
        .eq('trabajador_id', t.id)
        .eq('fecha', hoy)
    } else {
      await supabase.from('habilitaciones_recojo')
        .upsert({ trabajador_id: t.id, fecha: hoy, habilitado_por: supervisorId })
    }

    setLista(prev => prev.map(w => w.id === t.id ? { ...w, habilitado: !w.habilitado } : w))
    setLoading(null)
  }

  const habilitados = lista.filter(t => t.habilitado).length

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Car size={18} className="text-[#00D4FF]" />
        <h2 className="font-syne font-semibold text-white">Habilitar recojo hoy</h2>
        <span className="text-xs bg-[#131920] border border-[#1E2D42] text-[#94A3B8] px-2 py-0.5 rounded-full ml-auto">
          {habilitados} habilitados
        </span>
      </div>
      <p className="text-xs text-[#475569] mb-3">La habilitación expira al final del día</p>
      <div className="space-y-2">
        {lista.map(t => (
          <button key={t.id} onClick={() => toggle(t)} disabled={loading === t.id}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
              t.habilitado
                ? 'bg-[#00D4FF]/10 border-[#00D4FF]/40 hover:border-[#00D4FF]/60'
                : 'bg-[#131920] border-[#1E2D42] hover:border-[#2D3F55]'
            }`}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              t.habilitado ? 'bg-[#00D4FF] border-[#00D4FF]' : 'border-[#2D3F55]'
            }`}>
              {t.habilitado && <Check size={12} className="text-[#080B12]" strokeWidth={3} />}
            </div>
            <span className="text-sm text-white">{t.nombre} {t.apellido}</span>
            {loading === t.id && <span className="text-xs text-[#475569] ml-auto">...</span>}
            {t.habilitado && loading !== t.id && <span className="text-xs text-[#00D4FF] ml-auto">Habilitado</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
