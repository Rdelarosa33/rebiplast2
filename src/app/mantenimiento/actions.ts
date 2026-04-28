'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Solo mantenimiento puede modificar pagos
async function verificarMantenimiento() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, nombre, apellido')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'mantenimiento') return { error: 'Sin permisos' }
  return { user, profile }
}

// =============================================================
// AUTO-GENERAR DEUDAS MENSUALES (se ejecuta al cargar el panel)
// =============================================================
//
// Lógica:
//   1. Lee suscripcion.fecha_inicio (ej: 2026-04-26)
//   2. Calcula cuántos ciclos de 30 días han pasado hasta hoy
//   3. Para cada ciclo, verifica si existe ya una deuda con ese periodo
//   4. Si no existe, la crea
//
// Periodo se calcula como: ciclo N empieza en fecha_inicio + (N-1)*30 días
// y termina 30 días después. Identificador del periodo: "YYYY-MM-DD"
// (la fecha de inicio de ese ciclo).

export async function autogenerarDeudas() {
  const supabase = await createClient()

  // Traer suscripción
  const { data: sus } = await supabase
    .from('suscripcion')
    .select('fecha_inicio, precio_mensual, activa')
    .single()

  if (!sus || !sus.fecha_inicio || !sus.activa) {
    return { generados: 0, mensaje: 'Sin suscripción activa' }
  }

  const fechaInicio = new Date(sus.fecha_inicio)
  const hoy = new Date()
  const monto = sus.precio_mensual || 300

  // Calcular cuántos ciclos completos han pasado (mínimo 1 = el ciclo actual)
  // Cada ciclo dura 30 días.
  const diasTranscurridos = Math.floor((hoy.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24))
  const ciclosTranscurridos = Math.floor(diasTranscurridos / 30) + 1  // +1 porque el primer mes empieza en día 0

  if (ciclosTranscurridos <= 0) {
    return { generados: 0, mensaje: 'Aún no inicia el primer ciclo' }
  }

  // Traer las deudas existentes
  const { data: existentes } = await supabase
    .from('pagos_suscripcion')
    .select('periodo')

  const periodosExistentes = new Set((existentes || []).map((d: any) => d.periodo))

  // Crear las deudas que falten
  const inserts: any[] = []
  for (let i = 0; i < ciclosTranscurridos; i++) {
    const inicioCiclo = new Date(fechaInicio)
    inicioCiclo.setDate(inicioCiclo.getDate() + i * 30)
    const finCiclo = new Date(inicioCiclo)
    finCiclo.setDate(finCiclo.getDate() + 29)

    const periodo = inicioCiclo.toISOString().split('T')[0] // "YYYY-MM-DD"
    if (periodosExistentes.has(periodo)) continue

    const periodoLegible = `${inicioCiclo.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} → ${finCiclo.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}`

    inserts.push({
      monto,
      periodo,
      nota: `Ciclo ${i + 1}: ${periodoLegible}`,
      pagada: false,
    })
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('pagos_suscripcion').insert(inserts)
    if (error) {
      console.error('Error autogenerando deudas:', error)
      return { generados: 0, error: error.message }
    }
  }

  return { generados: inserts.length }
}

// =============================================================
// PAGOS DE RECARGAS OCR
// =============================================================

export async function marcarRecargaPagada(recargaId: string) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient()
  const { data: recarga } = await supabase
    .from('recargas_ocr')
    .select('monto')
    .eq('id', recargaId)
    .single()
  if (!recarga) return { error: 'Recarga no encontrada' }

  const { error } = await supabase
    .from('recargas_ocr')
    .update({
      pagada: true,
      fecha_pago: new Date().toISOString().split('T')[0],
      monto_pagado: recarga.monto,
    })
    .eq('id', recargaId)

  if (error) return { error: error.message }

  revalidatePath('/mantenimiento')
  revalidatePath('/admin/suscripcion')
  return { success: true }
}

export async function registrarPagoDetalladoRecarga(
  recargaId: string,
  data: { fecha_pago: string; nota?: string }
) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  if (!data.fecha_pago) return { error: 'Fecha requerida' }

  const supabase = await createClient()
  const { data: recarga } = await supabase
    .from('recargas_ocr')
    .select('monto, nota')
    .eq('id', recargaId)
    .single()
  if (!recarga) return { error: 'Recarga no encontrada' }

  const notaAnterior = recarga?.nota || ''
  const notaNueva = data.nota
    ? (notaAnterior ? `${notaAnterior} | Pago: ${data.nota}` : `Pago: ${data.nota}`)
    : notaAnterior

  const { error } = await supabase
    .from('recargas_ocr')
    .update({
      pagada: true,
      fecha_pago: data.fecha_pago,
      monto_pagado: recarga.monto,  // Solo pago completo
      nota: notaNueva || null,
    })
    .eq('id', recargaId)

  if (error) return { error: error.message }

  revalidatePath('/mantenimiento')
  revalidatePath('/admin/suscripcion')
  return { success: true }
}

// =============================================================
// PAGOS DE SUSCRIPCIÓN
// =============================================================

export async function marcarSuscripcionPagada(pagoId: string) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient()
  const { data: pago } = await supabase
    .from('pagos_suscripcion')
    .select('monto')
    .eq('id', pagoId)
    .single()
  if (!pago) return { error: 'Pago no encontrado' }

  const { error } = await supabase
    .from('pagos_suscripcion')
    .update({
      pagada: true,
      fecha_pago: new Date().toISOString().split('T')[0],
      monto_pagado: pago.monto,
    })
    .eq('id', pagoId)

  if (error) return { error: error.message }

  revalidatePath('/mantenimiento')
  revalidatePath('/admin/suscripcion')
  return { success: true }
}

export async function registrarPagoDetalladoSuscripcion(
  pagoId: string,
  data: { fecha_pago: string; nota?: string }
) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  if (!data.fecha_pago) return { error: 'Fecha requerida' }

  const supabase = await createClient()
  const { data: pago } = await supabase
    .from('pagos_suscripcion')
    .select('monto, nota')
    .eq('id', pagoId)
    .single()
  if (!pago) return { error: 'Pago no encontrado' }

  const notaAnterior = pago?.nota || ''
  const notaNueva = data.nota
    ? (notaAnterior ? `${notaAnterior} | Pago: ${data.nota}` : `Pago: ${data.nota}`)
    : notaAnterior

  const { error } = await supabase
    .from('pagos_suscripcion')
    .update({
      pagada: true,
      fecha_pago: data.fecha_pago,
      monto_pagado: pago.monto,  // Solo pago completo
      nota: notaNueva || null,
    })
    .eq('id', pagoId)

  if (error) return { error: error.message }

  revalidatePath('/mantenimiento')
  revalidatePath('/admin/suscripcion')
  return { success: true }
}

// =============================================================
// REINICIAR — al entregar el servicio, fecha_inicio = hoy
// =============================================================
// Esta acción se ejecuta SOLO desde Supabase manualmente cuando se
// entrega el servicio (por seguridad, no se expone en UI):
//
//   UPDATE suscripcion SET fecha_inicio = CURRENT_DATE;
//   DELETE FROM pagos_suscripcion;  -- o marcar todas como pagadas
//   DELETE FROM recargas_ocr WHERE pagada = false;
