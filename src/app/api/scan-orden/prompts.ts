// =============================================================
// PROMPTS OCR POR ASEGURADORA
// =============================================================
// Cada prompt es específico para un tipo de orden conocido.
// El usuario selecciona el tipo ANTES de subir la imagen, por
// lo que sabemos exactamente qué prompt usar.
// =============================================================

// Bloque común que todos los prompts incluyen
const COMUN = `
═══════════════════════════════════════════════════════════════
REGLAS UNIVERSALES (aplican siempre)
═══════════════════════════════════════════════════════════════

NUNCA usar estos como girador o taller (filtrar siempre):
- REBIPLAST / REBIPLAS / REIBPLAST (es el proveedor)
- RAFAEL GONZALES / GONZÁLES / GONZALEZ (interno)

Devuelve SOLO JSON válido sin texto adicional.

CANDIDATOS (lista TODO lo que veas):
- candidatos.entidades: TODOS los nombres de personas y empresas
  (excepto Rebiplast y Rafael Gonzales)
- candidatos.numeros_documento: TODOS los números identificadores
  (NO incluir RUCs de 11 dígitos)

PIEZAS (cada renglón = UNA pieza, NO agrupar):
- "REP", "REPARAR", "REPARACIÓN" → requiere_reparacion = true
- "PINTURA", "PINT", "+ Pintura" → requiere_pintura = true
- "PULIDO" → requiere_pulido = true
- "FARO", "NEBLINERO" → es_faro = true
- "REP+PINTURA", "RP" → ambas (reparacion + pintura)
- Si pieza está en VARIAS LÍNEAS de la misma celda, UNIRLAS en 1 sola

LADOS:
- LH/IZQ/Izquierdo → "LH"
- RH/DER/Derecho → "RH"
- DEL/DELT/Delantero → "DELT"
- POST/Posterior/Trasero → "POST"
- Sin lado → "N/A"

TIPO_TRABAJO:
- Solo Reparación → "R"
- Reparación + Pintura → "RP"
- Reparación + Pintura + Pulido (faro) → "RPP"
- Solo Pulido (faro sin cambio) → "PU"

MONTOS (extraer SIEMPRE si hay):
- monto_total: total del documento (TOTAL > SUBTOTAL > suma de piezas)
- moneda: "USD" si hay US$/Dólares, "PEN" si hay S//Soles
- monto por pieza: precio en la fila de cada pieza, null si no hay

ESTRUCTURA JSON DE RESPUESTA:
{
  "tipo_seguro_detectado": "RIMAC|MAPFRE|PACIFICO|LA_POSITIVA|INTERSEGURO|TALLER",
  "numero_siniestro": null,
  "numero_orden": null,
  "marca": null,
  "placa": null,
  "color": null,
  "nombre_girador": null,
  "taller_origen": null,
  "monto_total": null,
  "moneda": "USD",
  "datos_extra": {
    "expediente": null,
    "poliza": null,
    "modelo": null,
    "anio": null,
    "vin": null,
    "nombre_asegurado": null,
    "telefono_asegurado": null,
    "observaciones_orden": null
  },
  "candidatos": {
    "entidades": [],
    "numeros_documento": []
  },
  "piezas": [
    {
      "nombre": "",
      "lado": "N/A",
      "requiere_reparacion": false,
      "requiere_pintura": false,
      "es_faro": false,
      "requiere_pulido": false,
      "tipo_trabajo": null,
      "monto": null
    }
  ]
}
`

// =============================================================
// RIMAC
// =============================================================
const PROMPT_RIMAC = `Lee esta orden de trabajo automotriz emitida por RIMAC SEGUROS.

EL USUARIO YA CONFIRMÓ QUE ES RIMAC, ASUME tipo_seguro = "RIMAC".

Sin embargo, si la imagen claramente NO es de RIMAC (ej: muestra logo de
otra aseguradora visible), pon tipo_seguro_detectado con el valor real
para alertar al usuario.

═══════════════════════════════════════════════════════════════
RIMAC tiene 2 formatos. Identifica cuál es:
═══════════════════════════════════════════════════════════════

▸ FORMATO 1 (Aprobación): tabla con columnas CÓDIGO/DESCRIPCIÓN/CANT/MON/PRECIO
  - numero_orden: campo "NRO DE OC" (ej: "0000130631")
  - numero_siniestro: campo "SINIESTRO:" (ej: "991004")
  - taller_origen: campo "ATENCIÓN A TALLER" (ej: "TOYO SERVICE")
  - nombre_girador: nombre en "AUTORIZADO:" o "TÉCNICO:"
  - placa, marca, color: campos directos
  - piezas: tabla "DETALLE DE APROBACIÓN" → cada fila es 1 pieza

▸ FORMATO 2 (Orden de compra): tabla con Item/Cantidad/Descripción/Monto
  - numero_orden: campo "N°" (ej: "60354")
  - numero_siniestro: "Siniestro N°"
  - taller_origen: nombre después de "Sirvase entregar...a los Sres:"
  - nombre_girador: "TÉCNICO SINIESTROS VEHICULOS" (ej: "CESAR BANCES VENTO")
  - piezas: tabla con items numerados → cada fila con descripción

EN AMBOS FORMATOS:
- Ignorar "REBIPLAST" en campo "Sres:" o "PROVEEDOR" (es el proveedor)
- "Caso" es distinto a "Siniestro" (no confundir)
${COMUN}`

// =============================================================
// MAPFRE
// =============================================================
const PROMPT_MAPFRE = `Lee esta orden de trabajo emitida por MAPFRE PERÚ.

EL USUARIO YA CONFIRMÓ QUE ES MAPFRE, ASUME tipo_seguro = "MAPFRE".

Si la imagen NO es de Mapfre, pon tipo_seguro_detectado con el real.

═══════════════════════════════════════════════════════════════
ESTRUCTURA TÍPICA MAPFRE:
═══════════════════════════════════════════════════════════════

- numero_orden: campo "ORDEN DE TRABAJO" (ej: "202604280084")
- numero_siniestro: campo "SINIESTRO:" (ej: "100130126007752")
- taller_origen: campo "TALLER PRINCIPAL" (ej: "GACSA PERU S.A.C.")
  ⚠ NO usar "PROVEEDOR" porque ese es REBIPLAST
- nombre_girador: el PERITO al final del documento
  Buscar línea "* Perito: APELLIDO NOMBRE" (ej: "TAPIA HOSHI, LUIS EDUARDO")
- placa, marca, color, año: en sección "DATOS DEL VEHÍCULO"
- nombre_asegurado: campo "ASEGURADO:" arriba

PIEZAS (en tabla "DESCRIPCIÓN Y EVALUACIÓN DE DAÑOS"):
- Cada fila que empieza con "REP" + descripción es UNA pieza
- Si una celda contiene MÚLTIPLES "REP xxx" en líneas distintas,
  son PIEZAS SEPARADAS (no unir)
  Ejemplo: "REP MOLDURA MALETERA / REP FUNDA DEL / REP REJILLA DEL"
  → 3 piezas separadas

MONTO: campo "TOTAL A FACTURAR" o "TOTAL GENERAL"
${COMUN}`

// =============================================================
// PACIFICO
// =============================================================
const PROMPT_PACIFICO = `Lee esta orden de trabajo emitida por PACÍFICO SEGUROS o PACÍFICO ASISTE.

EL USUARIO YA CONFIRMÓ QUE ES PACÍFICO, ASUME tipo_seguro = "PACIFICO".

Si la imagen NO es de Pacífico, pon tipo_seguro_detectado con el real.

═══════════════════════════════════════════════════════════════
PACÍFICO tiene 2 formatos comunes:
═══════════════════════════════════════════════════════════════

▸ FORMATO PACÍFICO ASISTE (header con "@pacificoasiste.com.pe"):
  - numero_orden: campo "Folio:" (ej: "20260427-1227552_01")
  - numero_siniestro: campo "Siniestro:"
  - taller_origen: campo "Taller/Agencia:" (si es código numérico,
    buscar nombre en otro lado; si no, dejar null)
  - nombre_girador: campo "Nombre Usuario:" (ej: "Alberto Rotalde")
  - nombre_asegurado: campo "Afectado:"
  - placa: campo "Placa:"
  - marca: campo "Fabricante:"

▸ FORMATO EA Corp / Pacífico tradicional (header con nombre de TALLER):
  - El HEADER es el nombre del taller (ej: "EA Corp SAC")
  - taller_origen: ese header
  - nombre_girador: campo "Realizado por:" (ej: "Alex Roman")
  - nombre_asegurado: campo "Cliente:" (ej: "Alpiconsult S.A.C.")
  - tipo_seguro: del campo "Cia Seguro:" (será "PACIFICO")

EN AMBOS:
- piezas: tabla "DESCRIPCIÓN" o "OPERACION DESCRIPCION"
- monto: "TOTAL" o "Precio Total S/"
${COMUN}`

// =============================================================
// LA POSITIVA
// =============================================================
const PROMPT_LA_POSITIVA = `Lee esta orden de trabajo emitida por LA POSITIVA SEGUROS.

EL USUARIO YA CONFIRMÓ QUE ES LA POSITIVA, ASUME tipo_seguro = "LA_POSITIVA".

Si la imagen NO es de La Positiva, pon tipo_seguro_detectado con el real.

═══════════════════════════════════════════════════════════════
ESTRUCTURA TÍPICA LA POSITIVA:
═══════════════════════════════════════════════════════════════

- numero_orden: campo "N° OC-..." (ej: "OC-140962")
- numero_siniestro: campo "Siniestro:" (ej: "341043801")
- taller_origen: nombre del taller después de la frase
  "Sirvase entregar por nuestra cuenta a los señores ___"
  Ejemplo: "Sereinsa", "Alese La Marina", "Alese La Molina"
  ⚠ El nombre entre paréntesis (ej: "Luisa Yactayo - Asesor PyP")
  es el CONTACTO del taller, NO el nombre del taller
- nombre_girador: la persona que firma al final del documento
  (técnico de vehículos La Positiva)
- nombre_asegurado: campo "Asegurado:" en parte inferior
- placa, marca, modelo, año, color: en datos del vehículo

PIEZAS (tabla "Cantidad / Cambio/Reparación por / Descripción"):
- Cada fila de la tabla es UNA pieza
- La columna "Descripción" puede contener múltiples sub-piezas
  separadas por saltos de línea: extraer cada una por separado

MONTO: campo "US$ ... + IGV" o suma de precios en la descripción
${COMUN}`

// =============================================================
// INTERSEGURO (gestionado por Qualität u otros)
// =============================================================
const PROMPT_INTERSEGURO = `Lee esta orden de trabajo donde la aseguradora final es INTERSEGURO.

EL USUARIO YA CONFIRMÓ QUE ES INTERSEGURO, ASUME tipo_seguro = "INTERSEGURO".

Si la imagen NO es para Interseguro, pon tipo_seguro_detectado con el real.

═══════════════════════════════════════════════════════════════
ESTRUCTURA TÍPICA (suele venir vía Qualität):
═══════════════════════════════════════════════════════════════

- numero_orden: campo "ORDEN DE TRABAJO No." (ej: "15197")
- numero_siniestro: campo "Siniestro" (ej: "69-013711", con guión)
- taller_origen: el header del documento
  Si dice "Qualität", taller = "Qualität"
  Si es otro nombre, ese es el taller
- nombre_girador: nombre que firma como "Jefe de Siniestros" o similar
  Si no hay firma clara, dejar null
- nombre_asegurado: campo "Asegurado"
- placa, marca, modelo, año: en "DATOS DE LA POLIZA"
- moneda: campo "Moneda" (ej: "Dólares Americanos" → USD)

VERIFICAR ASEGURADORA:
- Buscar "Facturar a:" al final del documento
- Si dice "INTERSEGURO COMPAÑIA DE SEGUROS S.A" → confirma tipo_seguro = INTERSEGURO

PIEZAS:
- Las piezas están en "Observaciones:" como texto libre
  (ej: "REP FUNDA DEL PARACHOQUE / REP Y PULIR FAROS DEL LH Y RH")
- IGNORAR la tabla de montos genéricos (Planchado, Pintura, Mecánica,
  Reparación, Repuestos) — esas son CATEGORÍAS, no piezas
- Separar piezas por: comas, "/", saltos de línea, " Y "

MONTO: campo "Total" o "Monto neto sin IGV"
${COMUN}`

// =============================================================
// TALLER PARTICULAR (formato libre, sin aseguradora)
// =============================================================
const PROMPT_TALLER = `Lee esta orden de trabajo de un TALLER PARTICULAR (sin aseguradora).

ESTA NO ES UNA ORDEN DE ASEGURADORA. ASUME tipo_seguro = "TALLER".

═══════════════════════════════════════════════════════════════
INSTRUCCIONES:
═══════════════════════════════════════════════════════════════

Como es un formato libre, los campos pueden estar en cualquier lado.
Extrae TODO lo que puedas con sentido común:

- numero_orden: cualquier número de orden, OT, presupuesto, factura
  proforma. Buscar etiquetas: "N°", "Orden", "OT", "Folio", "Presupuesto"
- numero_siniestro: si lo hay (puede no haber, dejar null)
- taller_origen: el nombre del taller emisor (header del documento)
  ⚠ NUNCA poner "REBIPLAST"
- nombre_girador: persona que firma o autoriza
  ⚠ NUNCA poner "RAFAEL GONZALES"
- nombre_asegurado / cliente: dueño del vehículo o cliente final
- placa, marca, modelo, color, año: del vehículo

PIEZAS:
- Buscar listado/tabla de trabajos a realizar
- Cada renglón con descripción de pieza/trabajo es UNA pieza separada

MONTO:
- Total del documento si lo hay
- Si solo hay precios por pieza, sumarlos para monto_total
${COMUN}`

// =============================================================
// EXPORT - función que retorna el prompt según tipo
// =============================================================

export type TipoSeguroSeleccion = 'RIMAC' | 'MAPFRE' | 'PACIFICO' | 'LA_POSITIVA' | 'INTERSEGURO' | 'TALLER'

export function getPromptPorTipo(tipo: TipoSeguroSeleccion): string {
  switch (tipo) {
    case 'RIMAC': return PROMPT_RIMAC
    case 'MAPFRE': return PROMPT_MAPFRE
    case 'PACIFICO': return PROMPT_PACIFICO
    case 'LA_POSITIVA': return PROMPT_LA_POSITIVA
    case 'INTERSEGURO': return PROMPT_INTERSEGURO
    case 'TALLER': return PROMPT_TALLER
    default: return PROMPT_TALLER
  }
}
