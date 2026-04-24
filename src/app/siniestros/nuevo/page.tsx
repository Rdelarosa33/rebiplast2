'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { crearSiniestro } from '@/lib/actions'
import { SEGUROS } from '@/types'
import { Plus, Trash2, ArrowLeft, ArrowRight, Check, Wrench, Paintbrush, Sparkles, Camera, Upload, Loader2, X, AlertCircle } from 'lucide-react'

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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    numero_siniestro: '', numero_orden: '', expediente: '', poliza: '',
    placa: '', marca: '', modelo: '', anio: '', color: '', vin: '',
    nombre_asegurado: '', telefono_asegurado: '',
    tipo_seguro: 'MAPFRE', nombre_girador: '',
    taller_origen: '', fecha_recojo: new Date().toISOString().split('T')[0],
    hora_recojo: new Date().toTimeString().slice(0,5), fecha_entrega_estimada: '', observaciones: ''
  })

  const [piezas, setPiezas] = useState<PiezaForm[]>([{ ...PIEZA_VACIA }])

  const mejorarImagen = (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const escala = img.width < 1200 ? 1200 / img.width : 1
        const w = Math.round(img.width * escala)
        const h = Math.round(img.height * escala)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        const imageData = ctx.getImageData(0, 0, w, h)
        const data = imageData.data
        const factor = 1.6
        const intercept = 128 * (1 - factor)
        for (let i = 0; i < data.length; i += 4) {
          const gris = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114
          const val = Math.min(255, Math.max(0, gris * factor + intercept))
          data[i] = val; data[i+1] = val; data[i+2] = val
        }
        ctx.putImageData(imageData, 0, 0)
        URL.revokeObjectURL(url)
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.95)
      }
      img.src = url
    })
  }

  const procesarImagen = async (file: File) => {
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
      const res = await fetch('/api/scan-orden', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok || result.error) {
        setError('No se pudo leer la orden. Ingresa los datos manualmente.')
        setScanLoading(false)
        return
      }
      const d = result.data
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
        observaciones: d.observaciones || prev.observaciones,
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
          precio: p.precio ? String(p.precio) : '',
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
    if (field === 'es_faro' && value) { updated[i].requiere_pulido = true; updated[i].requiere_pintura = true }
    updated[i].tipo_trabajo = updated[i].requiere_pintura ? 'RP' : 'R'
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
    setFormKey(k => k + 1)
    setForm({
      numero_siniestro: '', numero_orden: '', expediente: '', poliza: '',
      placa: '', marca: '', modelo: '', anio: '', color: '', vin: '',
      nombre_asegurado: '', telefono_asegurado: '',
      tipo_seguro: 'MAPFRE', nombre_girador: '',
      taller_origen: '', fecha_recojo: new Date().toISOString().split('T')[0],
      hora_recojo: new Date().toTimeString().slice(0,5), fecha_entrega_estimada: '', observaciones: ''
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
            <p className="text-xs text-[#475569] mb-4">Toma foto de la orden y los datos se cargan automáticamente.</p>
            {scanLoading ? (
              <div className="flex flex-col items-center gap-3 py-6">
                {imagenPreview && <img src={imagenPreview} alt="Orden" className="w-40 h-40 object-cover rounded-xl opacity-50" />}
                <div className="flex items-center gap-2 text-[#00D4FF]">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Procesando imagen...</span>
                </div>
              </div>
            ) : imagenPreview ? (
              <div className="relative">
                <img src={imagenPreview} alt="Orden" className="w-full max-h-48 object-cover rounded-xl" />
                <button onClick={limpiarFormulario}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white">
                  <X size={14} />
                </button>
                <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded-xl p-2 text-xs text-green-400 text-center">
                  ✓ Datos cargados — revisa y corrige si es necesario
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-2 py-5 bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] hover:border-[#00D4FF]/30 rounded-xl transition-all">
                  <Camera size={24} className="text-[#00D4FF]" />
                  <span className="text-xs text-[#94A3B8]">Tomar foto</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center gap-2 py-5 bg-[#131920] hover:bg-[#1A2332] border border-[#1E2D42] hover:border-[#00D4FF]/30 rounded-xl transition-all">
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
              <div><label className="label">N° Siniestro *</label>
                <input className="input-field" value={form.numero_siniestro} onChange={e => setForm({...form, numero_siniestro: e.target.value})} placeholder="Ej: 100-130125001234" /></div>
              <div><label className="label">N° Orden</label>
                <input className="input-field" value={form.numero_orden} onChange={e => setForm({...form, numero_orden: e.target.value})} placeholder="Ej: 2025-01240189" /></div>
              <div><label className="label">Expediente</label>
                <input className="input-field" value={form.expediente} onChange={e => setForm({...form, expediente: e.target.value})} placeholder="Ej: 1-PPD" /></div>
              <div><label className="label">Póliza</label>
                <input className="input-field" value={form.poliza} onChange={e => setForm({...form, poliza: e.target.value})} /></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Vehículo</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Placa *</label>
                <input className="input-field uppercase" value={form.placa} onChange={e => setForm({...form, placa: e.target.value.toUpperCase()})} placeholder="Ej: ABC-123" /></div>
              <div><label className="label">Marca</label>
                <input className="input-field" value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} /></div>
              <div><label className="label">Modelo</label>
                <input className="input-field" value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} /></div>
              <div><label className="label">Año</label>
                <input className="input-field" type="number" value={form.anio} onChange={e => setForm({...form, anio: e.target.value})} /></div>
              <div><label className="label">Color</label>
                <input className="input-field" value={form.color} onChange={e => setForm({...form, color: e.target.value})} /></div>
              <div><label className="label">VIN / Chasis</label>
                <input className="input-field" value={form.vin} onChange={e => setForm({...form, vin: e.target.value})} /></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Seguro</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Compañía *</label>
                <select className="input-field" value={form.tipo_seguro} onChange={e => setForm({...form, tipo_seguro: e.target.value})}>
                  {SEGUROS.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label className="label">Girador</label>
                <input className="input-field" value={form.nombre_girador} onChange={e => setForm({...form, nombre_girador: e.target.value})} /></div>
              <div><label className="label">Asegurado</label>
                <input className="input-field" value={form.nombre_asegurado} onChange={e => setForm({...form, nombre_asegurado: e.target.value})} /></div>
              <div><label className="label">Teléfono</label>
                <input className="input-field" value={form.telefono_asegurado} onChange={e => setForm({...form, telefono_asegurado: e.target.value})} /></div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-syne font-semibold text-white">Taller y fecha</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="label">Taller de origen *</label>
                <input className="input-field" value={form.taller_origen} onChange={e => setForm({...form, taller_origen: e.target.value})} placeholder="Ej: Maquinarias SM" /></div>
              <div><label className="label">Fecha recojo</label>
                <input className="input-field" type="date" value={form.fecha_recojo} onChange={e => setForm({...form, fecha_recojo: e.target.value})} /></div>
              <div><label className="label">Hora</label>
                <input className="input-field" type="time" value={form.hora_recojo} onChange={e => setForm({...form, hora_recojo: e.target.value})} /></div>
              <div className="col-span-2"><label className="label">Observaciones</label>
                <textarea className="input-field" rows={2} value={form.observaciones} onChange={e => setForm({...form, observaciones: e.target.value})} /></div>
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
                  {pieza.tipo_trabajo === 'RP' ? 'Rep + Prep + Pintura' : 'Solo reparación'}
                  {pieza.es_faro ? ' + Pulido' : ''}
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
    </div>
  )
}
