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
// RECARGAS OCR
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
  data: { monto_pagado: number; fecha_pago: string; nota?: string }
) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  if (!data.monto_pagado || data.monto_pagado <= 0) return { error: 'Monto inválido' }
  if (!data.fecha_pago) return { error: 'Fecha requerida' }

  const supabase = await createClient()

  const { data: recarga } = await supabase
    .from('recargas_ocr')
    .select('nota')
    .eq('id', recargaId)
    .single()

  const notaAnterior = recarga?.nota || ''
  const notaNueva = data.nota
    ? (notaAnterior ? `${notaAnterior} | Pago: ${data.nota}` : `Pago: ${data.nota}`)
    : notaAnterior

  const { error } = await supabase
    .from('recargas_ocr')
    .update({
      pagada: true,
      fecha_pago: data.fecha_pago,
      monto_pagado: data.monto_pagado,
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

export async function generarDeudaSuscripcion() {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient()

  // Calcular periodo actual: YYYY-MM
  const ahora = new Date()
  const periodo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`

  // Verificar que no exista ya este periodo
  const { data: existe } = await supabase
    .from('pagos_suscripcion')
    .select('id')
    .eq('periodo', periodo)
    .maybeSingle()

  if (existe) {
    return { warn: `Ya existe un registro para el periodo ${periodo}` }
  }

  // Traer precio del plan actual
  const { data: sus } = await supabase
    .from('suscripcion')
    .select('precio_mensual')
    .single()

  const monto = sus?.precio_mensual || 300

  // Insertar deuda
  const { error } = await supabase.from('pagos_suscripcion').insert({
    monto,
    periodo,
    nota: `Generado automáticamente para periodo ${periodo}`,
    pagada: false,
  })

  if (error) return { error: error.message }

  revalidatePath('/mantenimiento')
  revalidatePath('/admin/suscripcion')
  return { success: true, periodo }
}

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
  data: { monto_pagado: number; fecha_pago: string; nota?: string }
) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  if (!data.monto_pagado || data.monto_pagado <= 0) return { error: 'Monto inválido' }
  if (!data.fecha_pago) return { error: 'Fecha requerida' }

  const supabase = await createClient()

  const { data: pago } = await supabase
    .from('pagos_suscripcion')
    .select('nota')
    .eq('id', pagoId)
    .single()

  const notaAnterior = pago?.nota || ''
  const notaNueva = data.nota
    ? (notaAnterior ? `${notaAnterior} | Pago: ${data.nota}` : `Pago: ${data.nota}`)
    : notaAnterior

  const { error } = await supabase
    .from('pagos_suscripcion')
    .update({
      pagada: true,
      fecha_pago: data.fecha_pago,
      monto_pagado: data.monto_pagado,
      nota: notaNueva || null,
    })
    .eq('id', pagoId)

  if (error) return { error: error.message }

  revalidatePath('/mantenimiento')
  revalidatePath('/admin/suscripcion')
  return { success: true }
}
