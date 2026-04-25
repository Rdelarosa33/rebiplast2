export type UserRole = 'admin' | 'recojo' | 'supervisor' | 'trabajador' | 'recojo_trabajador'

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
  trabajador: 'Trabajador',
  recojo_trabajador: 'Recojo / Trabajador',
}

export const ROLE_COLOR: Record<UserRole, string> = {
  admin: 'bg-red-500/20 text-red-300',
  recojo: 'bg-blue-500/20 text-blue-300',
  supervisor: 'bg-purple-500/20 text-purple-300',
  trabajador: 'bg-amber-500/20 text-amber-300',
  recojo_trabajador: 'bg-teal-500/20 text-teal-300',
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

  // ENTREGADO es estado final
  if (estado === 'ENTREGADO' && role !== 'admin') return []

  // ADMIN — puede mover a cualquier estado, siempre con nota
  if (role === 'admin') {
    const todos: PiezaEstado[] = [
      'EN_TRASLADO','RECIBIDO','ASIGNADO',
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
      }))
  }

  const acciones: Accion[] = []

  // RECOJO — sin confirmación
  if (role === 'recojo') {
    if (estado === 'REGISTRADO') {
      acciones.push({ label: 'Marcar en traslado', estado_nuevo: 'EN_TRASLADO', color: 'btn-primary' })
    }
    if (estado === 'LISTO_ENTREGA') {
      acciones.push({ label: 'Confirmar entrega al taller', estado_nuevo: 'ENTREGADO', color: 'btn-success' })
    }
  }

  // SUPERVISOR
  if (role === 'supervisor') {
    // Confirmar recepción
    if (estado === 'EN_TRASLADO') {
      acciones.push({ label: 'Confirmar recepción en taller', estado_nuevo: 'RECIBIDO', color: 'btn-primary' })
    }
    // Control de calidad — aprobar o devolver al mismo trabajador
    if (estado === 'CONTROL_CALIDAD') {
      acciones.push({ label: '✓ Aprobar — Listo para entrega', estado_nuevo: 'LISTO_ENTREGA', color: 'btn-success' })
      // Rechazar según qué incluye la pieza
      if (pieza?.requiere_pulido || pieza?.es_faro) {
        acciones.push({ label: '✗ Rechazar — Problema en pulido', estado_nuevo: 'EN_PULIDO', color: 'btn-danger', requiere_motivo: true })
      }
      if (pieza?.requiere_pintura) {
        acciones.push({ label: '✗ Rechazar — Problema en pintura', estado_nuevo: 'EN_PINTURA', color: 'btn-danger', requiere_motivo: true })
      }
      acciones.push({ label: '✗ Rechazar — Problema en reparación', estado_nuevo: 'ASIGNADO', color: 'btn-danger', requiere_motivo: true })
    }
    // Polivalente — puede avanzar cualquier etapa
    if (estado === 'ASIGNADO' || estado === 'EN_REPARACION') {
      const siguiente = pieza?.requiere_pintura ? 'EN_PREPARACION' : 'CONTROL_CALIDAD'
      acciones.push({ label: 'Marcar reparación terminada', estado_nuevo: siguiente, color: 'btn-secondary' })
    }
    if (estado === 'EN_PREPARACION') {
      acciones.push({ label: 'Marcar preparación terminada', estado_nuevo: 'EN_PINTURA', color: 'btn-secondary' })
    }
    if (estado === 'EN_PINTURA') {
      acciones.push({ label: 'Marcar pintura terminada', estado_nuevo: 'CONTROL_CALIDAD', color: 'btn-secondary' })
    }
    if (estado === 'EN_PULIDO') {
      acciones.push({ label: 'Marcar pulido terminado', estado_nuevo: 'CONTROL_CALIDAD', color: 'btn-secondary' })
    }
  }

  // TRABAJADOR — polivalente con flujo de aceptar/rechazar/terminar
  if (role === 'trabajador' || role === 'recojo_trabajador') {

    // ASIGNADO — aceptar o rechazar (devuelve al estado anterior)
    if (estado === 'ASIGNADO') {
      acciones.push({ label: '✓ Aceptar trabajo', estado_nuevo: 'EN_REPARACION', color: 'btn-primary' })
      acciones.push({ label: '✗ Rechazar — devolver', estado_nuevo: 'RECIBIDO', color: 'btn-danger', requiere_motivo: true })
    }

    // EN_REPARACION — terminar
    if (estado === 'EN_REPARACION') {
      const siguiente = pieza?.requiere_pintura ? 'EN_PREPARACION' : 'CONTROL_CALIDAD'
      const label = pieza?.requiere_pintura ? 'Terminado — pasar a preparación' : 'Terminado — control de calidad'
      acciones.push({ label, estado_nuevo: siguiente, color: 'btn-primary' })
    }

    // EN_PREPARACION — aceptar, rechazar (vuelve a reparación) o terminar
    if (estado === 'EN_PREPARACION') {
      acciones.push({ label: 'Terminado — pasar a pintura', estado_nuevo: 'EN_PINTURA', color: 'btn-primary' })
      acciones.push({ label: '✗ Rechazar — problema en reparación', estado_nuevo: 'ASIGNADO', color: 'btn-danger', requiere_motivo: true })
    }

    // EN_PINTURA — terminar o rechazar (vuelve a preparación)
    if (estado === 'EN_PINTURA') {
      if (pieza?.es_faro || pieza?.requiere_pulido) {
        acciones.push({ label: 'Terminado — pasar a pulido', estado_nuevo: 'EN_PULIDO', color: 'btn-primary' })
      } else {
        acciones.push({ label: 'Terminado — control de calidad', estado_nuevo: 'CONTROL_CALIDAD', color: 'btn-primary' })
      }
      acciones.push({ label: '✗ Rechazar — problema en preparación', estado_nuevo: 'EN_PREPARACION', color: 'btn-danger', requiere_motivo: true })
    }

    // EN_PULIDO — terminar
    if (estado === 'EN_PULIDO') {
      acciones.push({ label: 'Terminado — control de calidad', estado_nuevo: 'CONTROL_CALIDAD', color: 'btn-primary' })
      acciones.push({ label: '✗ Rechazar — problema en pintura', estado_nuevo: 'EN_PINTURA', color: 'btn-danger', requiere_motivo: true })
    }
  }

  // RECOJO_TRABAJADOR también puede recoger y entregar
  if (role === 'recojo_trabajador') {
    if (estado === 'EN_TRASLADO') {
      acciones.push({ label: 'Marcar en traslado', estado_nuevo: 'EN_TRASLADO', color: 'btn-primary' })
    }
    if (estado === 'LISTO_ENTREGA') {
      acciones.push({ label: 'Confirmar entrega al taller', estado_nuevo: 'ENTREGADO', color: 'btn-success' })
    }
  }

  return acciones
}
