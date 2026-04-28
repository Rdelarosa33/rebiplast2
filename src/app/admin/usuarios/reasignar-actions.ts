'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// =============================================================
// Verificar permisos: solo supervisor o admin pueden reasignar
// =============================================================

async function verificarSupervisorOAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nombre, apellido')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'supervisor'].includes(profile.role)) {
    return { error: 'Sin permisos para reasignar' }
  }
  return { user, profile }
}

// =============================================================
// REASIGNAR PIEZA INDIVIDUAL
// =============================================================
// Cambia el trabajador asignado a un campo específico de una pieza.
// Campo puede ser: reparacion, preparacion, pintura
//
// Ejemplo: el pintor falta y supervisor reasigna a otro pintor

export async function reasignarPieza(
  piezaId: string,
  campo: 'reparacion' | 'preparacion' | 'pintura',
  nuevoTrabajadorId: string,
  motivo?: string
) {
  const auth = await verificarSupervisorOAdmin()
  if ('error' in auth) return { error: auth.error }

  const supabase = await createClient()

  // Traer pieza actual
  const { data: pieza } = await supabase
    .from('piezas')
    .select('siniestro_id, estado, trabajador_reparacion_id, trabajador_reparacion_nombre, trabajador_preparacion_id, trabajador_preparacion_nombre, trabajador_pintura_id, trabajador_pintura_nombre, descripcion')
    .eq('id', piezaId)
    .single()

  if (!pieza) return { error: 'Pieza no encontrada' }
  if (pieza.estado === 'ENTREGADO') return { error: 'No se puede reasignar una pieza entregada' }
  if (pieza.estado === 'DEVUELTO') return { error: 'No se puede reasignar una pieza devuelta' }

  // Traer datos del nuevo trabajador
  const { data: nuevoTrab } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, role, activo')
    .eq('id', nuevoTrabajadorId)
    .single()

  if (!nuevoTrab) return { error: 'Trabajador no encontrado' }
  if (!nuevoTrab.activo) return { error: 'El trabajador está inactivo' }
  if (!['trabajador', 'recojo_trabajador'].includes(nuevoTrab.role)) {
    return { error: 'El usuario seleccionado no es trabajador' }
  }

  const nombreCompleto = `${nuevoTrab.nombre} ${nuevoTrab.apellido || ''}`.trim()

  // Mapear campo → columnas y valor anterior
  const mapaCampos: Record<string, { idCol: string; nombreCol: string; idAnterior: string | null; nombreAnterior: string | null; etiqueta: string }> = {
    reparacion: {
      idCol: 'trabajador_reparacion_id',
      nombreCol: 'trabajador_reparacion_nombre',
      idAnterior: pieza.trabajador_reparacion_id,
      nombreAnterior: pieza.trabajador_reparacion_nombre,
      etiqueta: 'Reparación',
    },
    preparacion: {
      idCol: 'trabajador_preparacion_id',
      nombreCol: 'trabajador_preparacion_nombre',
      idAnterior: pieza.trabajador_preparacion_id,
      nombreAnterior: pieza.trabajador_preparacion_nombre,
      etiqueta: 'Preparación / Pulido',
    },
    pintura: {
      idCol: 'trabajador_pintura_id',
      nombreCol: 'trabajador_pintura_nombre',
      idAnterior: pieza.trabajador_pintura_id,
      nombreAnterior: pieza.trabajador_pintura_nombre,
      etiqueta: 'Pintura',
    },
  }

  const info = mapaCampos[campo]
  if (!info) return { error: 'Campo inválido' }

  // Si el trabajador anterior es el mismo, no hacer nada
  if (info.idAnterior === nuevoTrabajadorId) {
    return { warn: 'Ese trabajador ya está asignado en este campo' }
  }

  // Actualizar
  const updates: any = {
    [info.idCol]: nuevoTrabajadorId,
    [info.nombreCol]: nombreCompleto,
    updated_at: new Date().toISOString(),
  }

  const { error: updErr } = await supabase
    .from('piezas')
    .update(updates)
    .eq('id', piezaId)

  if (updErr) return { error: updErr.message }

  // Registrar en historial
  const detalle = `${info.etiqueta}: ${info.nombreAnterior || '(sin asignar)'} → ${nombreCompleto}${motivo ? ` · Motivo: ${motivo}` : ''}`
  const nombreUsuario = `${auth.profile.nombre} ${auth.profile.apellido || ''}`.trim()
  await supabase.from('historial_piezas').insert({
    pieza_id: piezaId,
    siniestro_id: pieza.siniestro_id,
    estado_anterior: pieza.estado,
    estado_nuevo: pieza.estado,  // No cambia el estado, solo trabajador
    usuario_id: auth.user.id,
    usuario_nombre: nombreUsuario,
    usuario_role: auth.profile.role,
    accion: 'REASIGNAR',
    motivo: detalle,
  })

  revalidatePath('/supervisor')
  revalidatePath('/dashboard')
  revalidatePath('/admin/usuarios')
  revalidatePath(`/siniestros/${pieza.siniestro_id}`)

  return { success: true, mensaje: detalle }
}

// =============================================================
// REASIGNAR MASIVO — pasar TODAS las piezas activas de un trabajador a otro
// =============================================================
// Útil cuando un trabajador falta toda la jornada y supervisor pasa
// todas sus piezas a otro de un solo golpe.

export async function reasignarMasivo(
  trabajadorAnteriorId: string,
  trabajadorNuevoId: string,
  motivo?: string
) {
  const auth = await verificarSupervisorOAdmin()
  if ('error' in auth) return { error: auth.error }

  if (trabajadorAnteriorId === trabajadorNuevoId) {
    return { error: 'Origen y destino son el mismo trabajador' }
  }

  const supabase = await createClient()

  // Traer datos del nuevo trabajador
  const { data: nuevoTrab } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, role, activo')
    .eq('id', trabajadorNuevoId)
    .single()

  if (!nuevoTrab) return { error: 'Trabajador destino no encontrado' }
  if (!nuevoTrab.activo) return { error: 'El trabajador destino está inactivo' }
  if (!['trabajador', 'recojo_trabajador'].includes(nuevoTrab.role)) {
    return { error: 'El usuario destino no es trabajador' }
  }

  const nombreNuevo = `${nuevoTrab.nombre} ${nuevoTrab.apellido || ''}`.trim()

  // Traer datos del trabajador anterior (para historial)
  const { data: trabAnterior } = await supabase
    .from('profiles')
    .select('nombre, apellido')
    .eq('id', trabajadorAnteriorId)
    .single()
  const nombreAnterior = trabAnterior
    ? `${trabAnterior.nombre} ${trabAnterior.apellido || ''}`.trim()
    : 'Trabajador anterior'

  // Buscar TODAS las piezas activas (no entregadas/devueltas) que tengan al trabajador anterior en cualquier campo
  const { data: piezas } = await supabase
    .from('piezas')
    .select('id, siniestro_id, estado, trabajador_reparacion_id, trabajador_preparacion_id, trabajador_pintura_id')
    .or(
      `trabajador_reparacion_id.eq.${trabajadorAnteriorId},trabajador_preparacion_id.eq.${trabajadorAnteriorId},trabajador_pintura_id.eq.${trabajadorAnteriorId}`
    )
    .not('estado', 'in', '(ENTREGADO,DEVUELTO)')

  if (!piezas || piezas.length === 0) {
    return { warn: `${nombreAnterior} no tiene piezas activas para reasignar` }
  }

  let totalReasignadas = 0
  const detalleHistorial: any[] = []

  for (const pz of piezas) {
    const updates: any = { updated_at: new Date().toISOString() }
    const camposAfectados: string[] = []

    if (pz.trabajador_reparacion_id === trabajadorAnteriorId) {
      updates.trabajador_reparacion_id = trabajadorNuevoId
      updates.trabajador_reparacion_nombre = nombreNuevo
      camposAfectados.push('Reparación')
    }
    if (pz.trabajador_preparacion_id === trabajadorAnteriorId) {
      updates.trabajador_preparacion_id = trabajadorNuevoId
      updates.trabajador_preparacion_nombre = nombreNuevo
      camposAfectados.push('Preparación')
    }
    if (pz.trabajador_pintura_id === trabajadorAnteriorId) {
      updates.trabajador_pintura_id = trabajadorNuevoId
      updates.trabajador_pintura_nombre = nombreNuevo
      camposAfectados.push('Pintura')
    }

    if (camposAfectados.length === 0) continue

    const { error } = await supabase
      .from('piezas')
      .update(updates)
      .eq('id', pz.id)

    if (error) continue  // Si falla una, sigue con las demás

    totalReasignadas++
    detalleHistorial.push({
      pieza_id: pz.id,
      siniestro_id: pz.siniestro_id,
      estado_anterior: pz.estado,
      estado_nuevo: pz.estado,
      usuario_id: auth.user.id,
      usuario_nombre: `${auth.profile.nombre} ${auth.profile.apellido || ''}`.trim(),
      usuario_role: auth.profile.role,
      accion: 'REASIGNAR',
      motivo: `Reasignación masiva [${camposAfectados.join(', ')}]: ${nombreAnterior} → ${nombreNuevo}${motivo ? ` · Motivo: ${motivo}` : ''}`,
    })
  }

  // Insertar todos los registros de historial de un golpe
  if (detalleHistorial.length > 0) {
    await supabase.from('historial_piezas').insert(detalleHistorial)
  }

  revalidatePath('/supervisor')
  revalidatePath('/dashboard')
  revalidatePath('/admin/usuarios')

  return {
    success: true,
    total: totalReasignadas,
    mensaje: `${totalReasignadas} pieza(s) reasignada(s) de ${nombreAnterior} a ${nombreNuevo}`,
  }
}

// =============================================================
// LISTAR PIEZAS ACTIVAS DE UN TRABAJADOR
// (para mostrar en UI antes de hacer reasignación masiva)
// =============================================================

export async function obtenerPiezasActivasDeTrabajador(trabajadorId: string) {
  const auth = await verificarSupervisorOAdmin()
  if ('error' in auth) return { error: auth.error, piezas: [] }

  const supabase = await createClient()

  const { data: piezas, error } = await supabase
    .from('piezas')
    .select(`
      id, nombre, lado, estado, qr_code, tipo_trabajo,
      trabajador_reparacion_id, trabajador_preparacion_id, trabajador_pintura_id,
      siniestros (numero_siniestro, placa, marca, modelo)
    `)
    .or(
      `trabajador_reparacion_id.eq.${trabajadorId},trabajador_preparacion_id.eq.${trabajadorId},trabajador_pintura_id.eq.${trabajadorId}`
    )
    .not('estado', 'in', '(ENTREGADO,DEVUELTO)')
    .order('updated_at', { ascending: false })

  if (error) return { error: error.message, piezas: [] }

  // Para cada pieza, identificar en qué campo(s) tiene al trabajador
  const enriquecidas = (piezas || []).map((p: any) => {
    const campos: string[] = []
    if (p.trabajador_reparacion_id === trabajadorId) campos.push('Reparación')
    if (p.trabajador_preparacion_id === trabajadorId) campos.push('Preparación')
    if (p.trabajador_pintura_id === trabajadorId) campos.push('Pintura')
    return { ...p, campos_asignados: campos }
  })

  return { piezas: enriquecidas }
}
