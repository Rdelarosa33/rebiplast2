'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Receipt } from 'lucide-react'

interface ConceptoDesglose {
  concepto: string
  monto: number
}

const DESGLOSE: ConceptoDesglose[] = [
  { concepto: 'Infraestructura cloud (CDN + servidor de aplicación)', monto: 60 },
  { concepto: 'Base de datos PostgreSQL gestionada', monto: 105 },
  { concepto: 'Respaldos automáticos & redundancia', monto: 25 },
  { concepto: 'Soporte técnico y mantenimiento', monto: 100 },
  { concepto: 'Optimización del sistema y reportes', monto: 10 },
]

export default function DesgloseSuscripcion({ precio }: { precio: number }) {
  const [abierto, setAbierto] = useState(false)
  const total = DESGLOSE.reduce((acc, d) => acc + d.monto, 0)

  return (
    <div className="space-y-2">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center gap-2 text-xs bg-[#131920] border border-[#1E2D42] hover:border-[#00D4FF]/30 text-[#94A3B8] hover:text-[#00D4FF] rounded-lg px-3 py-2 transition-all"
      >
        <Receipt size={12} />
        <span className="flex-1 text-left">Ver detalle del plan</span>
        {abierto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {abierto && (
        <div className="bg-[#0D1117] border border-[#1E2D42] rounded-xl p-4 space-y-2">
          {DESGLOSE.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-1">
              <span className="text-xs text-[#94A3B8] flex-1">{d.concepto}</span>
              <span className="text-xs font-mono text-white">${d.monto.toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-[#1E2D42] pt-2 mt-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">TOTAL MENSUAL</span>
            <span className="text-sm font-mono font-bold text-[#00D4FF]">${total.toFixed(2)}</span>
          </div>
          {precio !== total && (
            <p className="text-[10px] text-[#475569] text-center pt-1">
              Plan actual: ${precio.toFixed(2)} · Total desglose: ${total.toFixed(2)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
