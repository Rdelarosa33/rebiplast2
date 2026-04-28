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

TIPO_TRABAJO (calcular tras los flags):
- Solo Reparación → "R"
- Reparación + Pintura → "RP"
- Reparación + Pintura + Pulido → "RPP"
- REGLA ESPECIAL FARO: si es_faro=true y tiene CUALQUIER trabajo
  (reparación, pintura o pulido) → tipo_trabajo = "RPP" SIEMPRE
  Razón: en el taller, trabajar un faro implica los 3 procesos.

Tipos eliminados: NO uses "PU" ni "P" solo. Si solo hay pulido en un faro → RPP.
Si solo hay pintura sin reparación → asumir "RP".

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

═══════════════════════════════════════════════════════════════
candidatos.numeros_documento (CRÍTICO - llenar SIEMPRE)
═══════════════════════════════════════════════════════════════

Listar TODOS los números identificadores que aparezcan en RIMAC. NO omitir.

EN FORMATO 1 (Aprobación) extraer:
- "NRO DE OC" (ej: "0000130631")
- "CASO:" (ej: "4135571")
- "SINIESTRO:" (ej: "991004")
- "PÓLIZA:" (ej: "1337526")

EN FORMATO 2 (Orden de compra) extraer:
- "N°" del documento (ej: "60354")
- "Siniestro N°" (ej: "1007582")
- "Póliza N°" (ej: "1622758")
- "Caso:" (ej: "4196945")
- "Item N°" si lo hay

NO incluir RUC (20381492371 o similares de 11 dígitos).

Ejemplo correcto candidatos.numeros_documento para FORMATO 1 RIMAC:
["0000130631", "4135571", "991004", "1337526"]
${COMUN}`

// =============================================================
// MAPFRE
// =============================================================
const PROMPT_MAPFRE = `Lee esta orden de trabajo emitida por MAPFRE PERÚ.

EL USUARIO YA CONFIRMÓ QUE ES MAPFRE, ASUME tipo_seguro = "MAPFRE".

Si la imagen NO es de Mapfre, pon tipo_seguro_detectado con el real.

═══════════════════════════════════════════════════════════════
⛔ REGLAS ABSOLUTAS - NUNCA HAGAS ESTO ⛔
═══════════════════════════════════════════════════════════════

NUNCA, BAJO NINGUNA CIRCUNSTANCIA, PONGAS:

❌ "REBIPLAST" / "REBIPLAST EIRL" / "REBIPLAST E.I.R.L." como girador
   → Rebiplast es SIEMPRE el PROVEEDOR. NUNCA el girador.
   → Si dudas, prefiere null antes que Rebiplast.

❌ El nombre del TALLER PRINCIPAL como girador
   → El taller (ej: "GACSA PERU S.A.C.") es taller_origen, NO girador.

❌ El nombre del ASEGURADO como girador
   → El asegurado (ej: "PAREDES LEON TABATHA PAMELA") es el dueño del carro.
   → NUNCA es girador.

❌ Razones sociales con "S.A.C.", "E.I.R.L.", "S.A." en girador
   → Empresas no son giradores en MAPFRE. El girador es una PERSONA NATURAL (perito).

Si no encuentras un PERITO claro en el documento → nombre_girador = null

═══════════════════════════════════════════════════════════════
ESTRUCTURA TÍPICA MAPFRE:
═══════════════════════════════════════════════════════════════

- numero_orden: campo "ORDEN DE TRABAJO" (ej: "202604280084")
- numero_siniestro: campo "SINIESTRO:" (ej: "100130126007752")
- taller_origen: campo "TALLER PRINCIPAL" (ej: "GACSA PERU S.A.C.")
  ⚠ NO usar "PROVEEDOR" porque ese es REBIPLAST
- placa, marca, color, año: en sección "DATOS DEL VEHÍCULO"
- nombre_asegurado: campo "ASEGURADO:" arriba

═══════════════════════════════════════════════════════════════
GIRADOR = PERITO (REGLA ABSOLUTA)
═══════════════════════════════════════════════════════════════

EN MAPFRE, EL GIRADOR ES SIEMPRE EL PERITO. ES UNA PERSONA NATURAL.

DÓNDE BUSCAR EL PERITO:

Al final del documento, después de las observaciones generales,
hay líneas que empiezan con asterisco (*). Busca específicamente
la que contiene "Perito" o "PERITO":

    * Perito: APELLIDO_PATERNO APELLIDO_MATERNO, NOMBRES

EJEMPLOS REALES (toma el texto DESPUÉS de "Perito:"):

▸ "* Perito: TAPIA HOSHI, LUIS EDUARDO"
   → nombre_girador = "TAPIA HOSHI, LUIS EDUARDO"

▸ "* Perito: MORALES PIZARRO, WILLIAM ELIO"
   → nombre_girador = "MORALES PIZARRO, WILLIAM ELIO"

▸ "* Perito: ISLACHIN LOAYZA, RUBEN"
   → nombre_girador = "ISLACHIN LOAYZA, RUBEN"

IMPORTANTE: La línea "* Perito:" suele estar entre líneas como:
- "* Tipo de cambio: 1.00"
- "* Presupuesto referencial sujeto a..."
- "* Montos sin considerar IGV"
- "* La factura debe ser presentada..."
- "* La vigencia de la orden..."

NO confundas estas otras líneas con "* Perito:". Lee con cuidado.

Si después de buscar bien NO encuentras una línea "* Perito:" en
el documento, deja nombre_girador = null. NO inventes.

═══════════════════════════════════════════════════════════════
PIEZAS — INTERPRETACIÓN PRECISA
═══════════════════════════════════════════════════════════════

Las piezas están en la tabla "DESCRIPCIÓN Y EVALUACIÓN DE DAÑOS".
Cada fila es UNA pieza. La columna "D" suele tener "REP" (que es el
CÓDIGO DE OPERACIÓN, no significa siempre reparación).

LO QUE DEFINE EL TRABAJO ES LA DESCRIPCIÓN. Lee TODAS las palabras:

▸ "REPARACIONES FUNDA DELT"
  → reparación de funda delantera
  → requiere_reparacion=true, lado="DELT", tipo_trabajo="R"

▸ "REPARACIONES FUNDA POSTERIOR"
  → requiere_reparacion=true, lado="POST", tipo_trabajo="R"

▸ "REPARACIONES PULIDO DE FARO DELT RH"
  → REPARACIÓN + PULIDO de un FARO (las 2 acciones se aplican).
  → es_faro=true, requiere_reparacion=true, requiere_pulido=true
  → REGLA FARO: como es faro y tiene trabajos, tipo_trabajo = "RPP" SIEMPRE
  → lado="RH" (lado lateral más importante que delantero)

▸ "REPARACIONES PINTURA DE PARACHOQUE"
  → reparación + pintura
  → requiere_reparacion=true, requiere_pintura=true, tipo_trabajo="RP"

▸ "PULIDO DE FARO DELT" (sin la palabra REPARACIONES)
  → pulido de faro
  → es_faro=true, requiere_pulido=true
  → REGLA FARO: tipo_trabajo = "RPP" SIEMPRE (faros = los 3 trabajos)

▸ "REPARACIONES REP MOLDURA MALETERA"
  → reparación
  → requiere_reparacion=true, tipo_trabajo="R"

REGLA ABSOLUTA DE FAROS:
Cualquier trabajo en una pieza que sea FARO (es_faro=true) genera
automáticamente tipo_trabajo="RPP", sin importar qué palabras aparezcan.
Esto es porque trabajar un faro siempre implica reparar + pintar + pulir
en el taller. NO uses "PU" ni "R" para faros.

PALABRAS CLAVE en la descripción (NO en la columna):
- Si dice "PULIDO" → requiere_pulido=true (NO reparación)
- Si dice "PINTURA" sin "REP" → requiere_pintura=true
- Si dice "REP" o "REPARACIÓN" en la descripción real → requiere_reparacion=true
- Si dice "FARO" o "NEBLINERO" → es_faro=true

═══════════════════════════════════════════════════════════════
LADOS — REGLA DE PRIORIDAD
═══════════════════════════════════════════════════════════════

Cuando una descripción tiene VARIAS palabras de posición, priorizar
el lado lateral sobre el delantero/posterior:

▸ "FARO DELT RH"  → lado="RH" (RH es más específico)
▸ "FUNDA POST LH" → lado="LH"
▸ "FUNDA DELT"    → lado="DELT" (no hay lado lateral)
▸ "MOLDURA POST"  → lado="POST"

Reglas individuales:
- LH / IZQ / Izquierdo → "LH"
- RH / DER / Derecho → "RH"
- DEL / DELT / Delantero → "DELT"
- POST / Posterior / Trasero → "POST"
- Sin posición clara → "N/A"

═══════════════════════════════════════════════════════════════
PIEZAS MULTILÍNEA
═══════════════════════════════════════════════════════════════

Si una celda contiene MÚLTIPLES "REP xxx" en líneas distintas,
son PIEZAS SEPARADAS (una por línea).

Ejemplo:
"REP MOLDURA MALETERA
REP FUNDA DEL
REP REJILLA DEL
REP SPOYLER INF"
→ 4 piezas separadas

═══════════════════════════════════════════════════════════════
MONTOS
═══════════════════════════════════════════════════════════════

monto_total: campo "TOTAL A FACTURAR" o "TOTAL GENERAL S/."
moneda: si dice "S/." → "PEN", si dice "US$" → "USD"
monto por pieza: el valor en la columna "PRECIO" de cada fila
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
