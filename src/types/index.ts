export type UserRole = 'admin' | 'recojo' | 'supervisor' | 'reparacion' | 'preparacion' | 'pintura'

export type PiezaEstado =
  | 'REGISTRADO'
  | 'EN_TRASLADO'
  | 'RECIBIDO'
  | 'ASIGNADO'
  | 'EN_REPARACION'
  | 'EN_PREPARACION'
  | 'EN_PINTURA'
  | 'EN_PULIDO'
  | 'CONTROL_CALIDAD'
  | 'LISTO_ENTREGA'
  | 'ENTREGADO'
  | 'DEVUELTO'

export type SeguroTipo = 'RIMAC' | 'PACIFICO' | 'MAPFRE' | 'LA_POSITIVA' | 'HDI' | 'INTERSEGURO' | 'TALLER' | 'OTRO'

export interface Profile {
  id: string
  nombre: string
  apellido: string
  email: string
  role: UserRole
  telefono?: string
  activo: boolean
  created_at: string
}

export interface Siniestro {
  id: string
  numero_siniestro: string
  numero_orden?: string
  expediente?: string
  poliza?: string
  placa: string
  marca?: string
  modelo?: string
  anio?: number
  color?: string
  vin?: string
  nombre_asegurado?: string
  telefono_asegurado?: string
  tipo_seguro: SeguroTipo
  nombre_girador?: string
  taller_origen: string
  fecha_recojo: string
  hora_recojo: string
  fecha_entrega_estimada?: string
  responsable_recojo_id?: string
  responsable_recojo_nombre?: string
  observaciones?: string
  activo: boolean
  created_at: string
  updated_at: string
  piezas?: Pieza[]
}

export interface Pieza {
  id: string
  siniestro_id: string
  qr_code: string
  nombre: string
  lado: string
  color?: string
  es_faro: boolean
  requiere_reparacion: boolean
  requiere_pintura: boolean
  requiere_pulido: boolean
  tipo_trabajo: string
  precio?: number
  estado: PiezaEstado
  trabajador_reparacion_id?: string
  trabajador_reparacion_nombre?: string
  trabajador_preparacion_id?: string
  trabajador_preparacion_nombre?: string
  trabajador_pintura_id?: string
  trabajador_pintura_nombre?: string
  observaciones?: string
  created_at: string
  updated_at: string
  siniestro?: Siniestro
  historial?: HistorialPieza[]
}

export interface HistorialPieza {
  id: string
  pieza_id: string
  siniestro_id: string
  estado_anterior?: PiezaEstado
  estado_nuevo: PiezaEstado
  usuario_id?: string
  usuario_nombre?: string
  usuario_role?: UserRole
  accion: string
  motivo?: string
  created_at: string
}

// ================================================
// ETIQUETAS Y COLORES
// ================================================

export const ESTADO_LABELS: Record<PiezaEstado, string> = {
  REGISTRADO: 'Registrado',
  EN_TRASLADO: 'En traslado',
  RECIBIDO: 'Recibido en taller',
  ASIGNADO: 'Asignado',
  EN_REPARACION: 'En reparación',
  EN_PREPARACION: 'En preparación',
  EN_PINTURA: 'En pintura',
  EN_PULIDO: 'En pulido',
  CONTROL_CALIDAD: 'Control de calidad',
  LISTO_ENTREGA: 'Listo para entrega',
  ENTREGADO: 'Entregado',
  DEVUELTO: 'Devuelto',
}

export const ESTADO_COLOR: Record<PiezaEstado, string> = {
  REGISTRADO: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  EN_TRASLADO: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  RECIBIDO: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  ASIGNADO: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  EN_REPARACION: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  EN_PREPARACION: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  EN_PINTURA: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  EN_PULIDO: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  CONTROL_CALIDAD: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  LISTO_ENTREGA: 'bg-green-500/20 text-green-300 border-green-500/30',
  ENTREGADO: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  DEVUELTO: 'bg-red-500/20 text-red-300 border-red-500/30',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  recojo: 'Recojo',
  supervisor: 'Supervisor',
  reparacion: 'Reparación',
  preparacion: 'Preparación',
  pintura: 'Pintura',
}

export const ROLE_COLOR: Record<UserRole, string> = {
  admin: 'bg-red-500/20 text-red-300',
  recojo: 'bg-blue-500/20 text-blue-300',
  supervisor: 'bg-purple-500/20 text-purple-300',
  reparacion: 'bg-amber-500/20 text-amber-300',
  preparacion: 'bg-orange-500/20 text-orange-300',
  pintura: 'bg-pink-500/20 text-pink-300',
}

export const SEGUROS: SeguroTipo[] = ['RIMAC', 'PACIFICO', 'MAPFRE', 'LA_POSITIVA', 'HDI', 'INTERSEGURO', 'TALLER', 'OTRO']

// ================================================
// ACCIONES POR ROL — LÓGICA ESTRICTA
// ================================================

export interface Accion {
  label: string
  estado_nuevo: PiezaEstado
  color: string
  requiere_motivo?: boolean
  descripcion?: string
  confirmacion?: string  // texto del modal de confirmación
}

export function getAcciones(estado: PiezaEstado, role: UserRole, pieza?: Partial<Pieza>): Accion[] {

  // ENTREGADO es estado final — nadie puede cambiarlo excepto admin
  if (estado === 'ENTREGADO' && role !== 'admin') return []

  // ADMIN — puede mover a cualquier estado con confirmación
  if (role === 'admin') {
    const todos: PiezaEstado[] = [
      'REGISTRADO','EN_TRASLADO','RECIBIDO','ASIGNADO',
      'EN_REPARACION','EN_PREPARACION','EN_PINTURA','EN_PULIDO',
      'CONTROL_CALIDAD','LISTO_ENTREGA','ENTREGADO'
    ]
    return todos
      .filter(e => e !== estado)
      .map(e => ({
        label: `Cambiar a: ${ESTADO_LABELS[e]}`,
        estado_nuevo: e,
        color: 'btn-secondary',
        requiere_motivo: true,
        confirmacion: `¿Confirmas cambiar el estado a "${ESTADO_LABELS[e]}"? Esta acción quedará registrada.`
      }))
  }

  const acciones: Accion[] = []

  // RECOJO
  if (role === 'recojo') {
    if (estado === 'REGISTRADO') {
      acciones.push({
        label: 'Marcar en traslado',
        estado_nuevo: 'EN_TRASLADO',
        color: 'btn-primary',
        confirmacion: '¿Confirmas que la pieza está en camino al taller?'
      })
    }
    if (estado === 'LISTO_ENTREGA') {
      acciones.push({
        label: 'Confirmar entrega al taller',
        estado_nuevo: 'ENTREGADO',
        color: 'btn-success',
        confirmacion: '¿Confirmas que la pieza fue entregada al taller de origen?'
      })
    }
  }

  // SUPERVISOR
  if (role === 'supervisor') {
    if (estado === 'EN_TRASLADO') {
      acciones.push({
        label: 'Confirmar recepción en taller',
        estado_nuevo: 'RECIBIDO',
        color: 'btn-primary',
        confirmacion: '¿Confirmas que la pieza llegó al taller y fue recepcionada?'
      })
    }
    if (estado === 'RECIBIDO') {
      acciones.push({
        label: 'Asignar a trabajador',
        estado_nuevo: 'ASIGNADO',
        color: 'btn-primary',
        confirmacion: '¿Confirmas la asignación de esta pieza?'
      })
    }
    if (estado === 'CONTROL_CALIDAD') {
      acciones.push({
        label: '✓ Aprobar — Listo para entrega',
        estado_nuevo: 'LISTO_ENTREGA',
        color: 'btn-success',
        confirmacion: '¿Confirmas que la pieza pasó el control de calidad y está lista para entrega?'
      })
      if (pieza?.requiere_pintura) {
        acciones.push({
          label: 'Devolver a pintura',
          estado_nuevo: 'EN_PINTURA',
          color: 'btn-danger',
          requiere_motivo: true,
          confirmacion: '¿Confirmas la devolución a pintura? Indica el motivo.'
        })
        acciones.push({
          label: 'Devolver a preparación',
          estado_nuevo: 'EN_PREPARACION',
          color: 'btn-danger',
          requiere_motivo: true,
          confirmacion: '¿Confirmas la devolución a preparación? Indica el motivo.'
        })
      }
      acciones.push({
        label: 'Devolver a reparación',
        estado_nuevo: 'EN_REPARACION',
        color: 'btn-danger',
        requiere_motivo: true,
        confirmacion: '¿Confirmas la devolución a reparación? Indica el motivo.'
      })
    }
  }

  // REPARACION
  if (role === 'reparacion') {
    if (estado === 'ASIGNADO' || estado === 'EN_REPARACION') {
      const siguiente = pieza?.requiere_pintura ? 'EN_PREPARACION' : 'CONTROL_CALIDAD'
      const desc = pieza?.requiere_pintura
        ? 'Reparación completada — pasa a preparación'
        : 'Reparación completada — pasa a control de calidad'
      acciones.push({
        label: 'Marcar reparación terminada',
        estado_nuevo: siguiente,
        color: 'btn-primary',
        descripcion: desc,
        confirmacion: `¿Confirmas que terminaste la reparación? ${desc}`
      })
    }
  }

  // PREPARACION
  if (role === 'preparacion') {
    if (estado === 'EN_PREPARACION') {
      acciones.push({
        label: 'Marcar preparación terminada',
        estado_nuevo: 'EN_PINTURA',
        color: 'btn-primary',
        descripcion: 'Preparación completada — pasa a pintura',
        confirmacion: '¿Confirmas que terminaste la preparación? La pieza pasa a pintura.'
      })
    }
  }

  // PINTURA
  if (role === 'pintura') {
    if (estado === 'EN_PINTURA') {
      acciones.push({
        label: 'Marcar pintura terminada',
        estado_nuevo: 'CONTROL_CALIDAD',
        color: 'btn-primary',
        descripcion: 'Pintura completada — pasa a control de calidad',
        confirmacion: '¿Confirmas que terminaste la pintura? La pieza pasa a control de calidad.'
      })
      if (pieza?.es_faro || pieza?.requiere_pulido) {
        acciones.push({
          label: 'Enviar a pulido',
          estado_nuevo: 'EN_PULIDO',
          color: 'btn-secondary',
          descripcion: 'Solo para faros',
          confirmacion: '¿Confirmas enviar a pulido?'
        })
      }
    }
    if (estado === 'EN_PULIDO') {
      acciones.push({
        label: 'Marcar pulido terminado',
        estado_nuevo: 'CONTROL_CALIDAD',
        color: 'btn-primary',
        descripcion: 'Pulido completado — pasa a control de calidad',
        confirmacion: '¿Confirmas que terminaste el pulido?'
      })
    }
  }

  return acciones
}
