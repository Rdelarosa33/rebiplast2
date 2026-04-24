import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ESTADO_LABELS, ESTADO_COLOR, PiezaEstado } from '@/types'
import { CheckCircle, Clock, Package, Wrench, Paintbrush, Sparkles, ShieldCheck, Truck } from 'lucide-react'

export const revalidate = 60 // revalidar cada 60 segundos

export default async function EstadoPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: siniestro } = await supabase
    .from('siniestros')
    .select(`
      id, numero_siniestro, placa, marca, modelo, anio, color,
      tipo_seguro, taller_origen, fecha_recojo, fecha_entrega_estimada,
      piezas (
        id, nombre, lado, color,
        requiere_reparacion, requiere_pintura, requiere_pulido, es_faro,
        estado,
        historial_piezas (
          estado_nuevo, accion, created_at
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!siniestro) notFound()

  const piezas = siniestro.piezas || []
  const total = piezas.length
  const entregadas = piezas.filter((p: any) => p.estado === 'ENTREGADO').length
  const listas = piezas.filter((p: any) => p.estado === 'LISTO_ENTREGA').length
  const enProceso = piezas.filter((p: any) => !['LISTO_ENTREGA','ENTREGADO'].includes(p.estado)).length
  const pct = total > 0 ? Math.round(((listas + entregadas) / total) * 100) : 0

  const ultimaActualizacion = new Date().toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const ESTADO_ICONO: Record<string, any> = {
    REGISTRADO: Package, EN_TRASLADO: Truck, RECIBIDO: Package,
    ASIGNADO: Wrench, EN_REPARACION: Wrench,
    EN_PREPARACION: Paintbrush, EN_PINTURA: Paintbrush, EN_PULIDO: Sparkles,
    CONTROL_CALIDAD: ShieldCheck, LISTO_ENTREGA: CheckCircle, ENTREGADO: CheckCircle,
  }

  // Color de progreso según porcentaje
  const progressColor = pct === 100 ? '#10b981' : pct >= 50 ? '#00D4FF' : '#f59e0b'

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header profesional */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderBottom: '3px solid #00D4FF' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #00D4FF, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Wrench size={22} color="white" />
              </div>
              <div>
                <p style={{ color: '#00D4FF', fontWeight: 800, fontSize: 18, margin: 0, letterSpacing: '-0.5px' }}>REBIPLAST</p>
                <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>Sistema de seguimiento de reparaciones</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 2px' }}>Actualizado</p>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0, fontFamily: 'monospace' }}>{ultimaActualizacion}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Datos del siniestro */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Orden de reparación</p>
              <p style={{ color: '#0f172a', fontWeight: 800, fontSize: 22, margin: '0 0 2px', fontFamily: 'monospace' }}>{siniestro.numero_siniestro}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>
                  {siniestro.placa}
                </span>
                {siniestro.marca && (
                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 20, fontSize: 12 }}>
                    {siniestro.marca} {siniestro.modelo || ''}
                  </span>
                )}
                <span style={{ background: '#eff6ff', color: '#3b82f6', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {siniestro.tipo_seguro}
                </span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 2px' }}>Taller</p>
              <p style={{ color: '#0f172a', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>{siniestro.taller_origen}</p>
              <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 2px' }}>Ingreso</p>
              <p style={{ color: '#0f172a', fontSize: 13, margin: 0 }}>
                {new Date(siniestro.fecha_recojo).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
              {siniestro.fecha_entrega_estimada && (
                <>
                  <p style={{ color: '#64748b', fontSize: 11, margin: '6px 0 2px' }}>Entrega estimada</p>
                  <p style={{ color: '#10b981', fontSize: 13, fontWeight: 600, margin: 0 }}>
                    {new Date(siniestro.fecha_entrega_estimada).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Progreso */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ color: '#0f172a', fontWeight: 700, fontSize: 15, margin: 0 }}>Progreso general</p>
            <p style={{ color: progressColor, fontWeight: 800, fontSize: 24, margin: 0 }}>{pct}%</p>
          </div>
          <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${progressColor}, ${progressColor}dd)`, width: `${pct}%`, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
              <span style={{ color: '#64748b', fontSize: 12 }}>{enProceso} en proceso</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ color: '#64748b', fontSize: 12 }}>{listas} lista{listas !== 1 ? 's' : ''} para entrega</span>
            </div>
            {entregadas > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />
                <span style={{ color: '#64748b', fontSize: 12 }}>{entregadas} entregada{entregadas !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {/* Piezas */}
        <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#0f172a', fontWeight: 700, fontSize: 15, margin: '0 0 14px' }}>
            Detalle de piezas ({total})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {piezas.map((pieza: any) => {
              const Icon = ESTADO_ICONO[pieza.estado] || Package
              const historial = (pieza.historial_piezas || []).sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )
              const ultimoEvento = historial[0]
              const esListo = pieza.estado === 'LISTO_ENTREGA' || pieza.estado === 'ENTREGADO'

              return (
                <div key={pieza.id} style={{
                  border: `1px solid ${esListo ? '#bbf7d0' : '#e2e8f0'}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: esListo ? '#f0fdf4' : '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  {/* Icono estado */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: esListo ? '#dcfce7' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={18} color={esListo ? '#10b981' : '#64748b'} />
                  </div>

                  {/* Datos pieza */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <p style={{ color: '#0f172a', fontWeight: 600, fontSize: 14, margin: 0 }}>{pieza.nombre}</p>
                      {pieza.lado && pieza.lado !== 'N/A' && (
                        <span style={{ color: '#64748b', fontSize: 12 }}>{pieza.lado}</span>
                      )}
                    </div>
                    {/* Servicios */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {pieza.requiere_reparacion && (
                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>REP</span>
                      )}
                      {pieza.requiere_pintura && (
                        <span style={{ background: '#fce7f3', color: '#9d174d', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>PIN</span>
                      )}
                      {pieza.requiere_pulido && (
                        <span style={{ background: '#ffe4e6', color: '#9f1239', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4 }}>PUL</span>
                      )}
                    </div>
                    {/* Último evento */}
                    {ultimoEvento && (
                      <p style={{ color: '#94a3b8', fontSize: 11, margin: '4px 0 0', fontFamily: 'monospace' }}>
                        {new Date(ultimoEvento.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>

                  {/* Estado badge */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      background: esListo ? '#dcfce7' : pieza.estado === 'EN_REPARACION' || pieza.estado === 'EN_PINTURA' ? '#fef3c7' : '#f1f5f9',
                      color: esListo ? '#065f46' : pieza.estado === 'EN_REPARACION' || pieza.estado === 'EN_PINTURA' ? '#92400e' : '#475569',
                      whiteSpace: 'nowrap'
                    }}>
                      {ESTADO_LABELS[pieza.estado as PiezaEstado]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ background: '#0f172a', borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <p style={{ color: '#00D4FF', fontWeight: 700, fontSize: 14, margin: '0 0 2px' }}>REBIPLAST E.I.R.L.</p>
            <p style={{ color: '#475569', fontSize: 11, margin: 0 }}>Av. Universitaria 437, San Miguel, Lima</p>
            <p style={{ color: '#475569', fontSize: 11, margin: '2px 0 0' }}>Tel: (01) 5663652</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#475569', fontSize: 10, margin: 0 }}>Esta página se actualiza automáticamente</p>
            <p style={{ color: '#475569', fontSize: 10, margin: '2px 0 0' }}>Rebiplast — Sistema de gestión de siniestros</p>
          </div>
        </div>

      </div>
    </div>
  )
}
