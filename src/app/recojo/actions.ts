'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ============================================================
// HELPERS
// ============================================================
async function getUserAndProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, nombre, apellido')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Sin perfil')
  return { supabase, user, profile }
}

function nombreCompleto(p: any) {
  return [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || 'Sistema'
}

function asegurarRolEs(profile: any, ...roles: string[]) {
  if (!roles.includes(profile.role)) {
    throw new Error('Sin permisos para esta acción')
  }
}

// ============================================================
// RECOJO: traer piezas del taller a Base
// ============================================================
// Estado: REGISTRADO → RECIBIDO
// Permisos: recojo, recojo_trabajador, admin, mantenimiento
export async function recogerPiezasDelTaller(piezaIds: string[]) {
  if (!piezaIds.length) throw new Error('No se seleccionaron piezas')

  const { supabase, profile } = await getUserAndProfile()
  asegurarRolEs(profile, 'recojo', 'recojo_trabajador', 'admin', 'mantenimiento')

  // Verificar que todas estén en estado REGISTRADO
  const { data: piezas, error: errLeer } = await supabase
    .from('piezas')
    .select('id, estado')
    .in('id', piezaIds)
  if (errLeer) throw new Error(errLeer.message)

  const noValidas = (piezas || []).filter(p => p.estado !== 'REGISTRADO')
  if (noValidas.length > 0) {
    throw new Error(`${noValidas.length} pieza(s) no están en estado REGISTRADO`)
  }

  // Cambiar estado masivo
  const { error: errUpdate } = await supabase
    .from('piezas')
    .update({
      estado: 'RECIBIDO',
      updated_at: new Date().toISOString(),
    })
    .in('id', piezaIds)
  if (errUpdate) throw new Error(errUpdate.message)

  // Registrar historial (si existe la tabla)
  for (const id of piezaIds) {
    await supabase.from('historial_piezas').insert({
      pieza_id: id,
      estado_anterior: 'REGISTRADO',
      estado_nuevo: 'RECIBIDO',
      usuario_id: profile.id,
      usuario_nombre: nombreCompleto(profile),
      usuario_role: profile.role,
      accion: 'recoger_taller',
      motivo: 'Recogido en taller',
    }).select()
  }

  revalidatePath('/recojo')
  revalidatePath('/dashboard')
  return { ok: true, cantidad: piezaIds.length }
}

// ============================================================
// RECOJO: entregar piezas al taller (cliente)
// ============================================================
// Estado: LISTO_ENTREGA → ENTREGADO
export async function entregarPiezasAlTaller(piezaIds: string[]) {
  if (!piezaIds.length) throw new Error('No se seleccionaron piezas')

  const { supabase, profile } = await getUserAndProfile()
  asegurarRolEs(profile, 'recojo', 'recojo_trabajador', 'admin', 'mantenimiento')

  const { data: piezas } = await supabase
    .from('piezas')
    .select('id, estado')
    .in('id', piezaIds)

  const noValidas = (piezas || []).filter(p => p.estado !== 'LISTO_ENTREGA')
  if (noValidas.length > 0) {
    throw new Error(`${noValidas.length} pieza(s) no están listas para entrega`)
  }

  const { error } = await supabase
    .from('piezas')
    .update({
      estado: 'ENTREGADO',
      updated_at: new Date().toISOString(),
    })
    .in('id', piezaIds)
  if (error) throw new Error(error.message)

  for (const id of piezaIds) {
    await supabase.from('historial_piezas').insert({
      pieza_id: id,
      estado_anterior: 'LISTO_ENTREGA',
      estado_nuevo: 'ENTREGADO',
      usuario_id: profile.id,
      usuario_nombre: nombreCompleto(profile),
      usuario_role: profile.role,
      accion: 'entregar_taller',
      motivo: 'Entregado al taller',
    }).select()
  }

  revalidatePath('/recojo')
  revalidatePath('/dashboard')
  return { ok: true, cantidad: piezaIds.length }
}

// ============================================================
// RECOJO: registrar reingreso (cliente devolvió pieza)
// ============================================================
// Estado: ENTREGADO → DEVUELTO + crear evento_reingreso
export async function registrarReingreso(
  piezaId: string,
  motivo: string,
  comentario: string
) {
  if (!piezaId) throw new Error('Falta pieza')
  if (!motivo) throw new Error('Falta motivo')

  const { supabase, profile } = await getUserAndProfile()
  asegurarRolEs(profile, 'recojo', 'recojo_trabajador', 'admin', 'mantenimiento')

  // Verificar que la pieza esté ENTREGADO
  const { data: pieza, error: errLeer } = await supabase
    .from('piezas')
    .select('id, estado, siniestro_id, updated_at')
    .eq('id', piezaId)
    .single()
  if (errLeer || !pieza) throw new Error('Pieza no encontrada')
  if (pieza.estado !== 'ENTREGADO') {
    throw new Error('Solo se puede registrar reingreso de piezas ya entregadas')
  }

  // Cambiar estado
  const { error: errEstado } = await supabase
    .from('piezas')
    .update({
      estado: 'DEVUELTO',
      updated_at: new Date().toISOString(),
    })
    .eq('id', piezaId)
  if (errEstado) throw new Error(errEstado.message)

  // Crear evento de reingreso
  const { error: errEvento } = await supabase.from('eventos_reingreso').insert({
    pieza_id: piezaId,
    siniestro_id: pieza.siniestro_id,
    motivo,
    comentario: comentario || null,
    registrado_por: profile.id,
    fecha_entrega_original: pieza.updated_at,
  })
  if (errEvento) throw new Error(errEvento.message)

  // Historial
  await supabase.from('historial_piezas').insert({
    pieza_id: piezaId,
    estado_anterior: 'ENTREGADO',
    estado_nuevo: 'DEVUELTO',
    usuario_id: profile.id,
    usuario_nombre: nombreCompleto(profile),
    usuario_role: profile.role,
    accion: 'registrar_reingreso',
    motivo: `Reingreso: ${motivo}${comentario ? ' - ' + comentario : ''}`,
  })

  revalidatePath('/recojo')
  revalidatePath('/supervisor')
  revalidatePath('/dashboard')
  return { ok: true }
}

// ============================================================
// SUPERVISOR: resolver reingreso
// ============================================================
// Acciones:
//  - 'asignar': pasa la pieza a EN_BASE (RECIBIDO) y se asigna trabajador
//  - 'rechazar': pieza vuelve a ENTREGADO (no era defecto real)
export async function resolverReingreso(
  eventoId: number,
  accion: 'asignar' | 'rechazar',
  trabajadorId?: string
) {
  const { supabase, profile } = await getUserAndProfile()
  asegurarRolEs(profile, 'supervisor', 'admin', 'mantenimiento')

  const { data: evento } = await supabase
    .from('eventos_reingreso')
    .select('id, pieza_id, resuelto')
    .eq('id', eventoId)
    .single()

  if (!evento) throw new Error('Evento no encontrado')
  if (evento.resuelto) throw new Error('Ya estaba resuelto')

  if (accion === 'asignar') {
    if (!trabajadorId) throw new Error('Falta trabajador')

    // Pieza vuelve a RECIBIDO (Base) y se asigna
    await supabase.from('piezas').update({
      estado: 'RECIBIDO',
      asignado_a: trabajadorId,
      updated_at: new Date().toISOString(),
    }).eq('id', evento.pieza_id)

    await supabase.from('historial_piezas').insert({
      pieza_id: evento.pieza_id,
      estado_anterior: 'DEVUELTO',
      estado_nuevo: 'RECIBIDO',
      usuario_id: profile.id,
      usuario_nombre: nombreCompleto(profile),
      usuario_role: profile.role,
      accion: 'aprobar_reingreso',
      motivo: 'Reingreso aprobado, reasignado a trabajador',
    })
  } else {
    // Rechazar reingreso → pieza vuelve a ENTREGADO
    await supabase.from('piezas').update({
      estado: 'ENTREGADO',
      updated_at: new Date().toISOString(),
    }).eq('id', evento.pieza_id)

    await supabase.from('historial_piezas').insert({
      pieza_id: evento.pieza_id,
      estado_anterior: 'DEVUELTO',
      estado_nuevo: 'ENTREGADO',
      usuario_id: profile.id,
      usuario_nombre: nombreCompleto(profile),
      usuario_role: profile.role,
      accion: 'rechazar_reingreso',
      motivo: 'Reingreso rechazado por supervisor',
    })
  }

  // Marcar evento como resuelto
  await supabase.from('eventos_reingreso').update({
    resuelto: true,
    resuelto_por: profile.id,
    resuelto_en: new Date().toISOString(),
    resolucion: accion === 'asignar' ? 'asignado' : 'rechazado',
    trabajador_asignado: accion === 'asignar' ? trabajadorId : null,
  }).eq('id', eventoId)

  revalidatePath('/recojo')
  revalidatePath('/supervisor')
  revalidatePath('/dashboard')
  return { ok: true }
}
