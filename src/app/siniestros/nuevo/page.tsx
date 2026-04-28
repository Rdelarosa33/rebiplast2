'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { crearSiniestro } from '@/lib/actions'
import { SEGUROS, getTipoTrabajo, getTipoTrabajoDescripcion } from '@/types'
import { Plus, Trash2, ArrowLeft, ArrowRight, Check, Wrench, Paintbrush, Sparkles, Camera, Upload, Loader2, X, AlertCircle } from 'lucide-react'
import DebugOCR from './DebugOCR'

interface PiezaForm {
  nombre: string
  lado: string
  color: string
  es_faro: boolean
  requiere_reparacion: boolean
  requiere_pintura: boolean
  requiere_pulido: boolean
  tipo_trabajo: string
  precio: string
  observaciones: string
}

const PIEZA_VACIA: PiezaForm = {
  nombre: '', lado: 'N/A', color: '', es_faro: false,
  requiere_reparacion: true, requiere_pintura: false, requiere_pulido: false,
  tipo_trabajo: 'R', precio: '', observaciones: ''
}

const LADOS = ['N/A', 'Izquierdo', 'Derecho', 'Frontal', 'Posterior']


export default function NuevoSiniestroPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1=datos, 2=piezas, 3=confirmacion
  const [loading, setLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [error, setError] = useState('')
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [scanResult, setScanResult] = useState<{ data?: any; debug?: any[]; gpt_raw?: string } | null>(null)
  const [advertenciaCalidad, setAdvertenciaCalidad] = useState<{ problemas: string[]; archivo: File } | null>(null)
  const [tipoSeleccionado, setTipoSeleccionado] = useState<'RIMAC' | 'MAPFRE' | 'PACIFICO' | 'LA_POSITIVA' | 'INTERSEGURO' | 'TALLER' | null>(null)
  const [alertaTipoMismatch, setAlertaTipoMismatch] = useState<string | null>(null)
  // Autocomplete de talleres desde BD
  const [sugerenciasTaller, setSugerenciasTaller] = useState<string[]>([])
  const [mostrarSugerenciasTaller, setMostrarSugerenciasTaller] = useState(false)
  const [tallerBuscando, setTallerBuscando] = useState(false)
  const [candidatos, setCandidatos] = useState<{
    seguros: string[];
    entidades: string[];
    candidatos_girador: string[];
    candidatos_taller: string[];
    numeros_documento: string[]
  }>({ seguros: [], entidades: [], candidatos_girador: [], candidatos_taller: [], numeros_documento: [] })
  const [camposDetectados, setCamposDetectados] = useState<{ tipo_seguro: boolean; nombre_girador: boolean; taller_origen: boolean }>({ tipo_seguro: false, nombre_girador: false, taller_origen: false })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    numero_siniestro: '', numero_orden: '', expediente: '', poliza: '',
    placa: '', marca: '', modelo: '', anio: '', color: '', vin: '',
    nombre_asegurado: '', telefono_asegurado: '',
    tipo_seguro: 'MAPFRE', nombre_girador: '',
    taller_origen: '', fecha_recojo: new Date().toISOString().split('T')[0],
    hora_recojo: new Date().toTimeString().slice(0,5), fecha_entrega_estimada: '', observaciones: '', monto_total: '', moneda: 'USD'
  })

  const [piezas, setPiezas] = useState<PiezaForm[]>([{ ...PIEZA_VACIA }])

  // Solo limita el tamaño si es muy grande (>3000px), pero NO altera color/contraste
  // La imagen va al servidor tal cual, GPT recibe la imagen real
  const mejorarImagen = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      // Si el archivo es < 3MB y caben en memoria sin problemas, mandar tal cual
      if (file.size < 3 * 1024 * 1024) {
        resolve(file)
        return
      }
      // Si es muy grande, redimensionar (sin tocar color ni contraste)
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const maxDim = 2400
        const ladoMayor = Math.max(img.width, img.height)
        const escala = ladoMayor > maxDim ? maxDim / ladoMayor : 1
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        URL.revokeObjectURL(url)
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.92)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(file)
      }
      img.src = url
    })
  }

  // Validar calidad de imagen ANTES de subir al servidor
  // Retorna lista de problemas encontrados (vacío = OK)
  const validarCalidadImagen = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const problemas: string[] = []

      // 1. Tipo de archivo
      const tiposValidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
      if (!tiposValidos.includes(file.type) && !file.name.match(/\.(jpe?g|png|webp|heic)$/i)) {
        problemas.push('Tipo de archivo no soportado (usar JPG, PNG, WEBP)')
        return resolve(problemas)
      }

      // 2. Tamaño en bytes
      const KB = 1024
      const MB = 1024 * KB
      if (file.size < 50 * KB) {
        problemas.push(`Archivo muy pequeño (${Math.round(file.size / KB)}KB, mínimo 50KB)`)
      }
      if (file.size > 15 * MB) {
        problemas.push(`Archivo muy grande (${Math.round(file.size / MB)}MB, máximo 15MB)`)
      }

      // 3. Dimensiones y brillo (requiere cargar la imagen)
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        // Resolución mínima: 600px en el lado más corto
        const ladoCorto = Math.min(img.width, img.height)
        if (ladoCorto < 600) {
          problemas.push(`Resolución baja: ${img.width}×${img.height} (recomendado: 600px+ en lado corto)`)
        }

        // Análisis de brillo: dibujar imagen pequeña en canvas y promediar pixels
        try {
          const canvas = document.createElement('canvas')
          const sampleSize = 100
          canvas.width = sampleSize
          canvas.height = sampleSize
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize)
            const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data
            let sumaBrillo = 0
            let pixeles = 0
            for (let i = 0; i < data.length; i += 4) {
              // Luminancia perceptual
              const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
              sumaBrillo += l
              pixeles++
            }
            const brilloPromedio = sumaBrillo / pixeles  // 0-255

            if (brilloPromedio < 40) {
              problemas.push('Imagen muy oscura (necesita más luz)')
            } else if (brilloPromedio > 235) {
              problemas.push('Imagen muy clara o sobre-expuesta')
            }
          }
        } catch (e) {
          // Si falla canvas (CORS u otra cosa), no bloqueamos
        }

        URL.revokeObjectURL(url)
        resolve(problemas)
      }

      img.onerror = () => {
        problemas.push('No se pudo leer el archivo como imagen')
        URL.revokeObjectURL(url)
        resolve(problemas)
      }

      img.src = url
    })
  }

  const procesarImagen = async (file: File) => {
    // Validación de calidad ANTES de subir al servidor (ahorra OCR si está mala)
    const problemas = await validarCalidadImagen(file)
    if (problemas.length > 0) {
      setAdvertenciaCalidad({ problemas, archivo: file })
      return
    }
    // Si pasa validación, procesar directo
    procesarImagenInterno(file)
  }

  const procesarImagenInterno = async (file: File) => {
    setScanLoading(true)
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => setImagenPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    try {
      const imagenMejorada = await mejorarImagen(file)
      const archivoProcesado = new File([imagenMejorada], file.name, { type: 'image/jpeg' })
      const fd = new FormData()
      fd.append('imagen', archivoProcesado)
      fd.append('tipo_seleccionado', tipoSeleccionado || 'TALLER')
      const res = await fetch('/api/scan-orden', { method: 'POST', body: fd })
      const result = await res.json()
      // Siempre guardamos el resultado para debug, exitoso o fallido
      setScanResult(result)
      if (!res.ok || result.error) {
        setError('No se pudo leer la orden. Ingresa los datos manualmente.')
        setScanLoading(false)
        return
      }
      const d = result.data
      // Si hay alerta de mismatch de tipo, mostrarla
      if (d.alerta_tipo_seguro) {
        setAlertaTipoMismatch(d.alerta_tipo_seguro)
      }
      // Guardar candidatos para sugerencias de UI
      setCandidatos({
        seguros: d.candidatos?.seguros || [],
        entidades: d.candidatos?.entidades || [],
        candidatos_girador: d.candidatos?.candidatos_girador || d.candidatos?.entidades || [],
        candidatos_taller: d.candidatos?.candidatos_taller || d.candidatos?.entidades || [],
        numeros_documento: d.candidatos?.numeros_documento || [],
      })
      // Marcar qué campos detectó el OCR (vs cuáles vienen vacíos)
      setCamposDetectados({
        tipo_seguro: !!d.tipo_seguro,
        nombre_girador: !!d.nombre_girador,
        taller_origen: !!d.taller_origen,
      })
      setForm(prev => ({
        ...prev,
        numero_siniestro: d.numero_siniestro || prev.numero_siniestro,
        numero_orden: d.numero_orden || prev.numero_orden,
        expediente: d.expediente || prev.expediente,
        poliza: d.poliza || prev.poliza,
        placa: d.placa || prev.placa,
        marca: d.marca || prev.marca,
        modelo: d.modelo || prev.modelo,
        anio: d.anio ? String(d.anio) : prev.anio,
        color: d.color || prev.color,
        vin: d.vin || prev.vin,
        nombre_asegurado: d.nombre_asegurado || prev.nombre_asegurado,
        telefono_asegurado: d.telefono_asegurado || prev.telefono_asegurado,
        tipo_seguro: d.tipo_seguro || prev.tipo_seguro,
        nombre_girador: d.nombre_girador || prev.nombre_girador,
        taller_origen: d.taller_origen || prev.taller_origen,
        fecha_recojo: prev.fecha_recojo, // siempre fecha real
        hora_recojo: prev.hora_recojo,
        observaciones: d.observaciones || prev.observaciones || '',
        monto_total: d.monto_total ? String(d.monto_total) : prev.monto_total,
        moneda: d.moneda || prev.moneda || 'USD',
      }))
      if (d.piezas && d.piezas.length > 0) {
        setPiezas(d.piezas.map((p: any) => ({
          nombre: p.nombre || '',
          lado: p.lado || 'N/A',
          color: p.color || '',
          es_faro: p.es_faro || false,
          requiere_reparacion: p.requiere_reparacion !== false,
          requiere_pintura: p.requiere_pintura || false,
          requiere_pulido: p.requiere_pulido || false,
          tipo_trabajo: p.tipo_trabajo || 'R',
          precio: p.monto != null ? String(p.monto) : (p.precio ? String(p.precio) : ''),
          observaciones: '',
        })))
      }
      setScanLoading(false)
    } catch {
      setError('Error al procesar la imagen.')
      setScanLoading(false)
    }
  }

  const updatePieza = (i: number, field: keyof PiezaForm, value: any) => {
    const updated = [...piezas]
    updated[i] = { ...updated[i], [field]: value }
    // Si marca pintura, auto-marca reparación (pintura siempre requiere rep)
    if (field === 'requiere_pintura' && value) { updated[i].requiere_reparacion = true }
    // Si marca es_faro, auto-marca pulido + pintura (y por consecuencia reparación)
    if (field === 'es_faro' && value) { updated[i].requiere_pulido = true; updated[i].requiere_pintura = true; updated[i].requiere_reparacion = true }
    // Si desmarca es_faro, auto-quita pulido (pulido solo aplica a faros)
    if (field === 'es_faro' && !value) { updated[i].requiere_pulido = false }
    // Recalcular tipo_trabajo desde los flags actuales
    updated[i].tipo_trabajo = getTipoTrabajo({
      requiere_reparacion: updated[i].requiere_reparacion,
      requiere_pintura: updated[i].requiere_pintura,
      requiere_pulido: updated[i].requiere_pulido,
      es_faro: updated[i].es_faro,
    })
    setPiezas(updated)
  }

  const agregarPieza = () => setPiezas([...piezas, { ...PIEZA_VACIA }])
  const eliminarPieza = (i: number) => piezas.length > 1 && setPiezas(piezas.filter((_, idx) => idx !== i))

  const validarStep1 = () => {
    if (!form.numero_siniestro) return 'Ingresa el número de siniestro'
    if (!form.placa) return 'Ingresa la placa'
    if (!form.taller_origen) return 'Ingresa el taller de origen'
    return null
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    fd.append('piezas', JSON.stringify(piezas))
    const result = await crearSiniestro(fd)
    if (result.error) { setError(result.error); setLoading(false) }
    else router.push(`/siniestros/${result.id}/imprimir`)
  }

  const limpiarFormulario = () => {
    setImagenPreview(null)
    setScanResult(null)
    setCandidatos({ seguros: [], entidades: [], candidatos_girador: [], candidatos_taller: [], numeros_documento: [] })
    setCamposDetectados({ tipo_seguro: false, nombre_girador: false, taller_origen: false })
    setFormKey(k => k + 1)
    setForm({
      numero_siniestro: '', numero_orden: '', expediente: '', poliza: '',
      placa: '', marca: '', modelo: '', anio: '', color: '', vin: '',
      nombre_asegurado: '', telefono_asegurado: '',
      tipo_seguro: 'MAPFRE', nombre_girador: '',
      taller_origen: '', fecha_recojo: new Date().toISOString().split('T')[0],
      hora_recojo: new Date().toTimeString().slice(0,5), fecha_entrega_estimada: '', observaciones: '', monto_total: '', moneda: 'USD'
    })
    setPiezas([{ ...PIEZA_VACIA }])
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(step - 1) : router.back()} className="text-[#475569] hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-syne font-bold text-white">Nuevo recojo</h1>
          <p className="text-xs text-[#475569]">Paso {step} de {step === 3 ? 3 : 2}</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex gap-2">
        {['Datos', 'Piezas', 'Confirmar'].map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${step > i ? 'bg-[#00D4FF]' : 'bg-[#1E2D42]'}`} />
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-sm text-red-400">
          <AlertCircle size={14} className="flex-shrink-0" />{error}
        </div>
      )}

      {/* STEP 1 — Datos */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Escanear orden */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Camera size={18} className="text-[#00D4FF]" />
              <h2 className="font-syne font-semibold text-white">Escanear orden</h2>
            </div>

            {/* Selector de tipo de aseguradora (obligatorio antes de subir) */}
            {!imagenPreview && (
              <div className="mb-4">
                <p className="text-xs text-[#94A3B8] mb-2">¿De qué tipo es la orden?</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { v: 'RIMAC', label: 'RIMAC' },
                    { v: 'MAPFRE', label: 'MAPFRE' },
                    { v: 'PACIFICO', label: 'PACIFICO' },
                    { v: 'LA_POSITIVA', label: 'LA POSITIVA' },
                    { v: 'INTERSEGURO', label: 'INTERSEGURO' },
                    { v: 'TALLER', label: 'TALLER PARTICULAR' },
                  ].map(t => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setTipoSeleccionado(t.v as any)}
                      className={`text-xs px-3 py-3 rounded-xl border font-semibold transition-all ${
                        tipoSeleccionado === t.v
                          ? 'bg-[#00D4FF] text-[#080B12] border-[#00D4FF]'
                          : 'bg-[#131920] text-[#94A3B8] border-[#1E2D42] hover:text-white hover:border-[#00D4FF]/30'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {tipoSeleccionado && (
                  <p className="text-[10px] text-green-400 mt-2">
                    ✓ Listo. Toma o sube la foto de la orden.
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-[#475569] mb-4">
              {tipoSeleccionado
                ? 'Toma foto de la orden y los datos se cargan automáticamente.'
                : 'Selecciona primero el tipo de orden, luego sube la imagen.'}
            </p>
            {scanLoading ? (
              <div className="flex flex-col items-center gap-3 py-6">
                {imagenPreview && <img src={imagenPreview} alt="Orden" className="w-40 h-40 object-cover rounded-xl opacity-50" />}
                <div className="flex items-center gap-2 text-[#00D4FF]">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Procesando imagen...</span>
                </div>
              </div>
            ) : imagenPreview ? (
              <div className="relative space-y-2">
                <img src={imagenPreview} alt="Orden" className="w-full max-h-48 object-cover rounded-xl" />
                <button onClick={limpiarFormulario}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white">
                  <X size={14} />
                </button>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-2 text-xs text-green-400 text-center">
                  ✓ Datos cargados — revisa y corrige si es necesario
                </div>
                {scanResult && (
                  <DebugOCR
                    debug={scanResult.debug}
                    gptRaw={scanResult.gpt_raw}
                    data={scanResult.data}
                  />
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={!tipoSeleccionado}
                  className="flex-1 flex flex-col items-center gap-2 py-5 bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] hover:border-[#00D4FF]/30 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#131920] disabled:hover:border-[#1E2D42]"
                >
                  <Camera size={24} className="text-[#00D4FF]" />
                  <span className="text-xs text-[#94A3B8]">Tomar foto</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!tipoSeleccionado}
                  className="flex-1 flex flex-col items-center gap-2 py-5 bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] hover:border-[#00D4FF]/30 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#131920] disabled:hover:border-[#1E2D42]"
                >
                  <Upload size={24} className="text-[#7C3AED]" />
                  <span className="text-xs text-[#94A3B8]">Subir imagen</span>
                </button>
              </div>
            )}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => e.target.files?.[0] && procesarImagen(e.target.files[0])} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && procesarImagen(e.target.files[0])} />
          </div>

          <div key={formKey} className="card p-5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Datos de la orden</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">N° Siniestro *</label>
                <input className="input-field" value={form.numero_siniestro} onChange={e => setForm({...form, numero_siniestro: e.target.value})} placeholder="Ej: 100-130125001234" />
                {candidatos.numeros_documento.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] text-[#475569] mb-1">Detectados (click para usar):</p>
                    <div className="flex flex-wrap gap-1">
                      {candidatos.numeros_documento.slice(0, 8).map((c, i) => (
                        <button key={i} type="button"
                          onClick={() => setForm({...form, numero_siniestro: c})}
                          className="text-[10px] font-mono bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF]/50 rounded px-2 py-0.5">
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="label">N° Orden</label>
                <input className="input-field" value={form.numero_orden} onChange={e => setForm({...form, numero_orden: e.target.value})} placeholder="Ej: 2025-01240189" />
                {candidatos.numeros_documento.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] text-[#475569] mb-1">Detectados (click para usar):</p>
                    <div className="flex flex-wrap gap-1">
                      {candidatos.numeros_documento.slice(0, 8).map((c, i) => (
                        <button key={i} type="button"
                          onClick={() => setForm({...form, numero_orden: c})}
                          className="text-[10px] font-mono bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF]/50 rounded px-2 py-0.5">
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Vehículo</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Placa *</label>
                <input className="input-field uppercase" value={form.placa} onChange={e => setForm({...form, placa: e.target.value.toUpperCase()})} placeholder="Ej: ABC-123" /></div>
              <div><label className="label">Marca</label>
                <input className="input-field" value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Color</label>
                <input className="input-field" value={form.color} onChange={e => setForm({...form, color: e.target.value})} /></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Seguro</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label flex items-center gap-2">
                  Compañía *
                  {scanResult && (camposDetectados.tipo_seguro
                    ? <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded">DETECTADO</span>
                    : <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">REVISAR</span>
                  )}
                </label>
                <select className="input-field" value={form.tipo_seguro} onChange={e => setForm({...form, tipo_seguro: e.target.value})}>
                  {SEGUROS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {candidatos.seguros.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {candidatos.seguros.slice(0, 4).map((c, i) => (
                      <button key={i} type="button"
                        onClick={() => setForm({...form, tipo_seguro: c.toUpperCase().replace(/\s+/g, '_')})}
                        className="text-[10px] bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF]/50 rounded px-2 py-0.5">
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  Girador
                  {scanResult && (camposDetectados.nombre_girador
                    ? <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded">DETECTADO</span>
                    : <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">REVISAR</span>
                  )}
                </label>
                <input className="input-field" value={form.nombre_girador} onChange={e => setForm({...form, nombre_girador: e.target.value})} />
                {candidatos.candidatos_girador.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] text-[#475569] mb-1">Detectados en la orden (click para usar):</p>
                    <div className="flex flex-wrap gap-1">
                      {candidatos.candidatos_girador.slice(0, 8).map((c, i) => (
                        <button key={i} type="button"
                          onClick={() => setForm({...form, nombre_girador: c})}
                          className="text-[10px] bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF]/50 rounded px-2 py-0.5 truncate max-w-full">
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Taller y fecha</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label flex items-center gap-2">
                  Taller de origen *
                  {scanResult && (camposDetectados.taller_origen
                    ? <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded">DETECTADO</span>
                    : <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">REVISAR</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    className="input-field"
                    value={form.taller_origen}
                    placeholder="Ej: Maquinarias SM"
                    onChange={async (e) => {
                      const v = e.target.value
                      setForm({...form, taller_origen: v})
                      if (v.length >= 2) {
                        setTallerBuscando(true)
                        setMostrarSugerenciasTaller(true)
                        try {
                          const res = await fetch(`/api/buscar-talleres?q=${encodeURIComponent(v)}`)
                          const data = await res.json()
                          setSugerenciasTaller(data.talleres || [])
                        } catch {
                          setSugerenciasTaller([])
                        }
                        setTallerBuscando(false)
                      } else {
                        setSugerenciasTaller([])
                        setMostrarSugerenciasTaller(false)
                      }
                    }}
                    onFocus={() => {
                      if (sugerenciasTaller.length > 0) setMostrarSugerenciasTaller(true)
                    }}
                    onBlur={() => {
                      // Delay para que el click en sugerencia funcione
                      setTimeout(() => setMostrarSugerenciasTaller(false), 150)
                    }}
                  />
                  {mostrarSugerenciasTaller && (sugerenciasTaller.length > 0 || tallerBuscando) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0D1117] border border-[#1E2D42] rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto">
                      {tallerBuscando && (
                        <div className="px-3 py-2 text-xs text-[#475569]">Buscando...</div>
                      )}
                      {!tallerBuscando && sugerenciasTaller.length === 0 && (
                        <div className="px-3 py-2 text-xs text-[#475569]">Sin coincidencias en BD</div>
                      )}
                      {sugerenciasTaller.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setForm({...form, taller_origen: s})
                            setMostrarSugerenciasTaller(false)
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-[#94A3B8] hover:bg-[#131920] hover:text-[#00D4FF] border-b border-[#1E2D42] last:border-b-0"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {candidatos.candidatos_taller.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] text-[#475569] mb-1">Detectados en la orden (click para usar):</p>
                    <div className="flex flex-wrap gap-1">
                      {candidatos.candidatos_taller.slice(0, 8).map((c, i) => (
                        <button key={i} type="button"
                          onClick={() => setForm({...form, taller_origen: c})}
                          className="text-[10px] bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-[#00D4FF] hover:border-[#00D4FF]/50 rounded px-2 py-0.5 truncate max-w-full">
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div><label className="label">Fecha recojo</label>
                <input className="input-field" type="date" value={form.fecha_recojo} onChange={e => setForm({...form, fecha_recojo: e.target.value})} /></div>
              <div><label className="label">Hora</label>
                <input className="input-field" type="time" value={form.hora_recojo} onChange={e => setForm({...form, hora_recojo: e.target.value})} /></div>
              <div className="col-span-2"><label className="label">Observaciones</label>
                <textarea className="input-field" rows={2} value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Monto Total</label>
                <input className="input-field" type="number" step="0.01" placeholder="0.00"
                  value={form.monto_total} onChange={e => setForm({...form, monto_total: e.target.value})} /></div>
                <div><label className="label">Moneda</label>
                <select className="input-field" value={form.moneda} onChange={e => setForm({...form, moneda: e.target.value})}>
                  <option value="USD">USD ($)</option>
                  <option value="PEN">PEN (S/)</option>
                </select></div>
              </div>
            </div>
          </div>

          <button onClick={() => {
            const err = validarStep1()
            if (err) { setError(err); return }
            setError(''); setStep(2)
          }} className="btn-primary w-full justify-center py-3">
            Continuar — Verificar piezas <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* STEP 2 — Piezas */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-syne font-semibold text-white">Piezas <span className="text-[#00D4FF]">{piezas.length}</span></h2>
            <button onClick={agregarPieza} className="btn-secondary text-xs py-1.5"><Plus size={14} /> Agregar</button>
          </div>

          {piezas.map((pieza, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#00D4FF]">Pieza {i + 1}</span>
                {piezas.length > 1 && <button onClick={() => eliminarPieza(i)} className="text-[#475569] hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label">Nombre *</label>
                  <input className="input-field" value={pieza.nombre} onChange={e => updatePieza(i, 'nombre', e.target.value)} placeholder="Funda Delantera, Fender..." /></div>
                <div><label className="label">Lado</label>
                  <select className="input-field" value={pieza.lado} onChange={e => updatePieza(i, 'lado', e.target.value)}>
                    {LADOS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select></div>
                <div><label className="label">Color</label>
                  <input className="input-field" value={pieza.color} onChange={e => updatePieza(i, 'color', e.target.value)} placeholder="NEGRO PP, COLOR..." /></div>
                <div className="col-span-2"><label className="label">Monto ({form.moneda})</label>
                  <input className="input-field" type="number" step="0.01" value={pieza.precio} onChange={e => updatePieza(i, 'precio', e.target.value)} placeholder="0.00" /></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${pieza.requiere_reparacion ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-[#131920] border-[#1E2D42] text-[#475569]'}`}>
                  <input type="checkbox" className="hidden" checked={pieza.requiere_reparacion} onChange={e => updatePieza(i, 'requiere_reparacion', e.target.checked)} />
                  <Wrench size={14} /> <span className="text-xs">Reparación</span>
                </label>
                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${pieza.requiere_pintura ? 'bg-pink-500/20 border-pink-500/40 text-pink-300' : 'bg-[#131920] border-[#1E2D42] text-[#475569]'}`}>
                  <input type="checkbox" className="hidden" checked={pieza.requiere_pintura} onChange={e => updatePieza(i, 'requiere_pintura', e.target.checked)} />
                  <Paintbrush size={14} /> <span className="text-xs">Pintura</span>
                </label>
                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${pieza.es_faro ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-[#131920] border-[#1E2D42] text-[#475569]'}`}>
                  <input type="checkbox" className="hidden" checked={pieza.es_faro} onChange={e => updatePieza(i, 'es_faro', e.target.checked)} />
                  <Sparkles size={14} /> <span className="text-xs">Es faro (pulido)</span>
                </label>
              </div>
              <div className="bg-[#131920] rounded-xl px-3 py-2 text-xs">
                <span className="font-mono font-bold text-[#00D4FF]">{pieza.tipo_trabajo}</span>
                <span className="text-[#475569] ml-2">
                  {getTipoTrabajoDescripcion(pieza.tipo_trabajo)}
                </span>
              </div>
            </div>
          ))}

          <button onClick={() => { setError(''); setStep(3) }}
            disabled={piezas.some(p => !p.nombre)}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50">
            Revisar y confirmar <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* STEP 3 — Confirmación */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-syne font-semibold text-white">Resumen del recojo</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><p className="text-xs text-[#475569]">Siniestro</p><p className="font-mono font-bold text-[#00D4FF]">{form.numero_siniestro}</p></div>
              <div><p className="text-xs text-[#475569]">Placa</p><p className="font-mono font-bold text-white">{form.placa}</p></div>
              <div><p className="text-xs text-[#475569]">Seguro</p><p className="text-white">{form.tipo_seguro}</p></div>
              <div><p className="text-xs text-[#475569]">Taller</p><p className="text-white truncate">{form.taller_origen}</p></div>
              <div><p className="text-xs text-[#475569]">Fecha</p><p className="text-white">{form.fecha_recojo} {form.hora_recojo}</p></div>
              {form.marca && <div><p className="text-xs text-[#475569]">Vehículo</p><p className="text-white">{form.marca} {form.modelo}</p></div>}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-syne font-semibold text-white mb-3">Piezas a recoger ({piezas.length})</h3>
            <div className="space-y-2">
              {piezas.map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#131920] rounded-xl">
                  <span className="text-xs font-bold text-[#00D4FF] w-5">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.nombre} {p.lado !== 'N/A' ? `— ${p.lado}` : ''}</p>
                    <p className="text-xs text-[#475569]">
                      {p.requiere_reparacion && 'Rep '}
                      {p.requiere_pintura && 'Pin '}
                      {p.es_faro && 'Pul'}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#475569]">{p.tipo_trabajo}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
            Al confirmar, todas las piezas quedarán en <strong>En traslado</strong> y se generarán los códigos QR para imprimir.
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">{error}</div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary flex-1 justify-center">
              <ArrowLeft size={16} /> Editar
            </button>
            <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1 justify-center py-3">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Registrando...</>
                : <><Check size={16} /> Confirmar e imprimir QR</>}
            </button>
          </div>
        </div>
      )}

      {/* Modal advertencia calidad foto */}
      {advertenciaCalidad && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1117] border border-amber-500/30 rounded-2xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-xl">⚠</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-syne font-bold text-white">Foto puede no leerse bien</h3>
                <p className="text-xs text-[#94A3B8] mt-1">El sistema detectó:</p>
              </div>
            </div>

            <ul className="space-y-1.5 bg-[#131920] rounded-xl p-3">
              {advertenciaCalidad.problemas.map((p, i) => (
                <li key={i} className="text-xs text-amber-300 flex items-start gap-2">
                  <span className="text-amber-400 flex-shrink-0">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-[#475569]">
              Tomar otra foto suele dar mejor resultado y ahorra créditos OCR.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setAdvertenciaCalidad(null)}
                className="flex-1 btn-primary text-sm py-2"
              >
                Tomar otra foto
              </button>
              <button
                onClick={() => {
                  const archivo = advertenciaCalidad.archivo
                  setAdvertenciaCalidad(null)
                  procesarImagenInterno(archivo)
                }}
                className="text-sm bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-white px-4 py-2 rounded-lg"
              >
                Continuar igual
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal alerta de tipo mismatch (usuario eligió X pero parece ser Y) */}
      {alertaTipoMismatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D1117] border border-amber-500/30 rounded-2xl p-5 max-w-md w-full space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-xl">⚠</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-syne font-bold text-white">Tipo de orden no coincide</h3>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Seleccionaste <span className="text-[#00D4FF] font-semibold">{tipoSeleccionado?.replace('_', ' ')}</span>{' '}
                  pero la imagen parece ser de{' '}
                  <span className="text-amber-400 font-semibold">{alertaTipoMismatch.replace('_', ' ')}</span>.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#475569]">
              Los datos pueden estar mal extraídos. Te recomendamos volver a escanear con el tipo correcto.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTipoSeleccionado(alertaTipoMismatch as any)
                  setAlertaTipoMismatch(null)
                  limpiarFormulario()
                }}
                className="flex-1 btn-primary text-sm py-2"
              >
                Cambiar a {alertaTipoMismatch.replace('_', ' ')}
              </button>
              <button
                onClick={() => setAlertaTipoMismatch(null)}
                className="text-sm bg-[#131920] border border-[#1E2D42] text-[#94A3B8] hover:text-white px-4 py-2 rounded-lg"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
