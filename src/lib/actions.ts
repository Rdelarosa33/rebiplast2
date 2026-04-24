'use server'

import { createClient } from '@/lib/supabase/server'
import { PiezaEstado, UserRole } from '@/types'
import { revalidatePath } from 'next/cache'

export async function cambiarEstadoPieza(
  piezaId: string,
  estadoNuevo: PiezaEstado,
  accion: string,
  motivo?: string
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: pieza } = await supabase
    .from('piezas')
    .select('*, siniestro:siniestros(*)')
    .eq('id', piezaId)
    .single()

  if (!pieza) return { error: 'Pieza no encontrada' }

  // Actualizar estado
  const { error } = await supabase
    .from('piezas')
    .update({ estado: estadoNuevo, updated_at: new Date().toISOString() })
    .eq('id', piezaId)

  if (error) return { error: error.message }

  // Registrar historial
  await supabase.from('historial_piezas').insert({
    pieza_id: piezaId,
    siniestro_id: pieza.siniestro_id,
    estado_anterior: pieza.estado,
    estado_nuevo: estadoNuevo,
    usuario_id: user.id,
    usuario_nombre: profile ? `${profile.nombre} ${profile.apellido}`.trim() : user.email,
    usuario_role: profile?.role,
    accion,
    motivo: motivo || null,
  })

  revalidatePath('/dashboard')
  revalidatePath(`/scan/${piezaId}`)
  revalidatePath(`/siniestros/${pieza.siniestro_id}`)
  revalidatePath('/supervisor')
  revalidatePath('/trabajador')

  return { success: true }
}

export async function asignarTrabajadores(
  piezaId: string,
  data: {
    trabajador_reparacion_id?: string
    trabajador_reparacion_nombre?: string
    trabajador_preparacion_id?: string
    trabajador_preparacion_nombre?: string
    trabajador_pintura_id?: string
    trabajador_pintura_nombre?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: pieza } = await supabase.from('piezas').select('siniestro_id,estado').eq('id', piezaId).single()
  if (!pieza) return { error: 'Pieza no encontrada' }

  const { error } = await supabase
    .from('piezas')
    .update({ ...data, estado: 'ASIGNADO', updated_at: new Date().toISOString() })
    .eq('id', piezaId)

  if (error) return { error: error.message }

  await supabase.from('historial_piezas').insert({
    pieza_id: piezaId,
    siniestro_id: pieza.siniestro_id,
    estado_anterior: pieza.estado,
    estado_nuevo: 'ASIGNADO',
    usuario_id: user.id,
    accion: 'ASIGNADO',
  })

  revalidatePath('/supervisor')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function crearSiniestro(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  // Verificar duplicado
  const numeroSiniestro = formData.get('numero_siniestro') as string
  const { data: existente } = await supabase
    .from('siniestros')
    .select('id, placa')
    .eq('numero_siniestro', numeroSiniestro)
    .single()

  if (existente) {
    return { error: `El siniestro ${numeroSiniestro} ya está registrado (placa: ${existente.placa})` }
  }

  // Insertar siniestro
  const { data: siniestro, error: sinError } = await supabase
    .from('siniestros')
    .insert({
      numero_siniestro: formData.get('numero_siniestro'),
      numero_orden: formData.get('numero_orden') || null,
      expediente: formData.get('expediente') || null,
      poliza: formData.get('poliza') || null,
      placa: formData.get('placa'),
      marca: formData.get('marca') || null,
      modelo: formData.get('modelo') || null,
      anio: formData.get('anio') ? parseInt(formData.get('anio') as string) : null,
      color: formData.get('color') || null,
      vin: formData.get('vin') || null,
      nombre_asegurado: formData.get('nombre_asegurado') || null,
      telefono_asegurado: formData.get('telefono_asegurado') || null,
      tipo_seguro: formData.get('tipo_seguro'),
      nombre_girador: formData.get('nombre_girador') || null,
      taller_origen: formData.get('taller_origen'),
      fecha_recojo: formData.get('fecha_recojo'),
      hora_recojo: formData.get('hora_recojo'),
      fecha_entrega_estimada: formData.get('fecha_entrega_estimada') || null,
      observaciones: formData.get('observaciones') || null,
      responsable_recojo_id: user.id,
      responsable_recojo_nombre: profile ? `${profile.nombre} ${profile.apellido}`.trim() : '',
    })
    .select()
    .single()

  if (sinError) return { error: sinError.message }

  // Insertar piezas
  const piezasJSON = formData.get('piezas') as string
  const piezas = JSON.parse(piezasJSON)

  for (const pieza of piezas) {
    const qr = 'QR-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    const { data: piezaData } = await supabase
      .from('piezas')
      .insert({
        siniestro_id: siniestro.id,
        qr_code: qr,
        nombre: pieza.nombre,
        lado: pieza.lado || 'N/A',
        color: pieza.color || null,
        es_faro: pieza.es_faro || false,
        requiere_reparacion: pieza.requiere_reparacion !== false,
        requiere_pintura: pieza.requiere_pintura || false,
        requiere_pulido: pieza.requiere_pulido || false,
        tipo_trabajo: pieza.tipo_trabajo || 'R',
        precio: pieza.precio ? parseFloat(pieza.precio) : null,
        observaciones: pieza.observaciones || null,
        estado: 'EN_TRASLADO',
      })
      .select()
      .single()

    if (piezaData) {
      await supabase.from('historial_piezas').insert({
        pieza_id: piezaData.id,
        siniestro_id: siniestro.id,
        estado_anterior: null,
        estado_nuevo: 'EN_TRASLADO',
        usuario_id: user.id,
        usuario_nombre: profile ? `${profile.nombre} ${profile.apellido}`.trim() : '',
        usuario_role: profile?.role,
        accion: 'RECOJO',
      })
    }
  }

  revalidatePath('/siniestros')
  revalidatePath('/dashboard')
  return { success: true, id: siniestro.id }
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return profile
}
