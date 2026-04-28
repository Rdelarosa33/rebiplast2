'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function verificarMantenimiento() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: profile } = await supabase.from('profiles').select('role, nombre, apellido').eq('id', user.id).single()
  if (!profile || profile.role !== 'mantenimiento') return { error: 'Sin permisos' }
  return { user, profile }
}

export async function marcarRecargaPagada(recargaId: string) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient()

  // Traer recarga para registrar el monto pagado por defecto = monto original
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
  return { success: true }
}

export async function registrarPagoDetallado(
  recargaId: string,
  data: { monto_pagado: number; fecha_pago: string; nota?: string }
) {
  const auth = await verificarMantenimiento()
  if ('error' in auth) return { error: auth.error }

  if (!data.monto_pagado || data.monto_pagado <= 0) {
    return { error: 'Monto inválido' }
  }
  if (!data.fecha_pago) {
    return { error: 'Fecha requerida' }
  }

  const supabase = await createClient()

  // Concatenar nota nueva con la existente (si hay)
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
  return { success: true }
}
