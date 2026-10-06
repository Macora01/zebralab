# ZebraLab — PRD

## Descripción
Aplicación web para diseñar etiquetas Zebra ZPL visualmente y enviarlas a imprimir desde Mac, sin depender de ZebraDesigner (solo disponible en Windows).

- **Marca:** BoaIdeia
- **Stack:** FastAPI + MongoDB + React
- **Impresora:** Zebra ZD220 (203 dpi)
- **Repositorio:** https://github.com/Macora01/zebralab.git
- **VPS:** https://zebra.facore.cl

---

## Versiones

| Versión | Cambios |
|---|---|
| 1.0 | MVP: editor visual, plantillas, exportar .prn, vista previa Labelary |
| 1.1 | Lote CSV/XLSX para diseños visuales, agente local de impresión |
| 1.2 | Lote CSV/XLSX para plantillas .prn importadas, fix CORS agente VPS |
| 1.3 | Fix `agentInfo is not defined` en BatchModal (blank page al subir XLSX) |
| 1.4 | Fix cantidad exacta multi-up (quantity param en generate_zpl), fix Chrome/Safari PNA (Origin dinámico en agente), migración imágenes a Emergent Object Storage |

---

## Arquitectura

- **Frontend:** React 19 (CRA + Craco), Tailwind CSS, @phosphor-icons
- **Backend:** FastAPI + Motor (MongoDB async) + Pandas + Pillow + Requests (Labelary)
- **Agente local:** Python puro (sin deps), HTTP server en localhost:17331, usa CUPS/lp

---

## Funcionalidades implementadas

### Editor visual
- Canvas drag & drop (mm)
- Elementos: texto estático, texto variable `{nombre}`, códigos de barras (QR/Code128/EAN13/EAN8/Code39/UPC-A), rectángulo, línea, imagen (→ ZPL ^GFA)
- Zoom, capas, multi-up (grilla N×M)
- Panel de propiedades por elemento

### Plantillas
- Guardar / actualizar / duplicar / eliminar
- Importar archivos .prn existentes (almacena rawZpl)
- CRUD en MongoDB

### Impresión
- Exportar .prn descargable
- Vista previa real via Labelary
- Impresión directa via agente local

### Lote CSV/XLSX
- Para diseños visuales: BatchModal (barra superior)
- Para plantillas .prn importadas: RawTemplateModal → tab "Lote CSV/XLSX"
- Auto-mapeo de variables, columna cantidad, vista previa primera etiqueta

### Agente local (Mac)
- zebralab_agent.py: HTTP server en localhost:17331
- CORS configurado para VPS HTTPS (Access-Control-Allow-Private-Network: true)
- Endpoints: /health, /printers, /print
- Descargable desde la app

---

## Backlog pendiente

| Prioridad | Feature |
|---|---|
| P1 | Confirmar fix Chrome/Safari en VPS del usuario (ver instrucciones de deploy) |
| P1 | Agregar EMERGENT_LLM_KEY en Coolify para activar subida de imágenes |
| P2 | App de escritorio Mac (Tauri o Electron) |
| P2 | Multi-usuario con autenticación |
| P2 | Historial de impresión / logs |
| P3 | Monetización con Stripe |
| P3 | Catálogo de plantillas pre-hechas |

---

## Deploy en Coolify — variables de entorno requeridas

Agregar en la configuración de entorno del contenedor backend:
- `EMERGENT_LLM_KEY=sk-emergent-...` (obtener desde Emergent Dashboard → Profile → Universal Key)

Esto activa la subida de imágenes/logos al Object Storage. Sin esta variable, la app funciona normalmente excepto la función "Imagen/Logo".

---

## Credenciales de prueba
N/A — sin autenticación en MVP
