import { AlertTriangle, Phone, Mail } from 'lucide-react'

export default function SuscripcionVencidaPage() {
  return (
    <div className="min-h-screen bg-[#080B12] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
          <AlertTriangle size={40} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-syne font-bold text-white mb-2">Suscripción vencida</h1>
          <p className="text-[#475569]">
            Tu suscripción ha vencido. Contacta con nosotros para renovarla y continuar usando RebiplastPRO.
          </p>
        </div>
        <div className="card p-5 space-y-3 text-left">
          <p className="text-sm font-semibold text-white">Contacto para renovación:</p>
          <div className="flex items-center gap-3 text-sm text-[#94A3B8]">
            <Phone size={16} className="text-[#00D4FF]" />
            <span>+51 999 999 999</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#94A3B8]">
            <Mail size={16} className="text-[#00D4FF]" />
            <span>soporte@rebiplastpro.pe</span>
          </div>
        </div>
        <p className="text-xs text-[#2D3F55]">RebiplastPRO — Sistema de Gestión de Siniestros</p>
      </div>
    </div>
  )
}
