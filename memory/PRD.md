# ZebraLab — Diseñador visual de etiquetas Zebra ZD220

## Problem statement (original, ES)
Usuario tiene impresora Zebra ZD220. ZebraDesigner Essentials solo corre en Windows.
Trabaja en Mac. Tiene un script Python (Tkinter) que toma archivos .prn (ZPL) y los
imprime via CUPS (`lp -d Zebra_... -o raw`). Quiere una app web/desktop para diseñar
visualmente esos .prn desde Mac.

Marca: BoaIdeia (tienda). Paleta marrón. Etiquetas pequeñas (50x30mm y 50x100mm).
Tipo: Web app primero, desktop después. Posible monetización futura.

## Architecture
- Backend: FastAPI + MongoDB (motor)
  - `zpl_generator.py`: convierte design JSON → ZPL II (203 dpi, 8 dots/mm)
  - Endpoints: /api/zpl/{generate,export,preview}, /api/templates CRUD, /api/batch/{parse,generate}
  - Preview via Labelary public API (http://api.labelary.com)
- Frontend: React (CRA + craco), Tailwind, @phosphor-icons/react
  - 3-panel layout: Tools sidebar | Canvas | Properties panel
  - Drag-and-drop con divs absolutely positioned (sin Konva)
  - Modals: Plantillas, Lote CSV, Vista previa
- Companion script (Mac): `/app/companion/zebralab_print.py` — imprime .prn vía `lp`, soporta clipboard y watch-folder

## Core requirements (estado)
- [x] Editor visual canvas (mm)
- [x] Tamaños predefinidos: 50x30, 50x100, 100x50, custom
- [x] Texto (fuentes ZPL A/B/D/F/0, tamaño en mm, rotación 0/90/180/270)
- [x] Códigos de barras: QR, Code128, EAN13, EAN8, Code39, UPC-A
- [x] Rectángulos, líneas
- [x] Campos variables {variable_name} (compatible con script Python existente)
- [x] Plantillas: guardar/cargar/duplicar/eliminar (Mongo)
- [x] Lote CSV/Excel: parseo, auto-mapeo por nombre de columna, columna cantidad, descarga .prn
- [x] Vista previa real vía Labelary
- [x] Exportar .prn descargable
- [x] Preservación de placeholders {var} en ZPL (interop con script original)
- [x] Special case "precio" -> "$ valor" (replicado del script original)
- [ ] App de escritorio Mac (pendiente - fase 2)
- [ ] Imágenes/logos en el editor (deferred - fase 2)
- [ ] Multi-usuario, autenticación, planes Stripe (fase 4)

## Implemented (history)
- 2026-01-19: MVP completo (backend + frontend + companion script)
  - Backend: 12/12 pytest pasados
  - Frontend: validado por testing agent (todos los flujos)
  - Patch en craco.config.js para compatibilidad webpack-dev-server v5 vs react-scripts 5

## Backlog (próximas fases)
- P1: Empaquetado como app de escritorio (Tauri o Electron)
- P1: Soporte de imágenes/logos (conversión a ^GFA)
- P1: Botón "Imprimir directo" en la web que envía a un endpoint local del companion script
- P2: Multi-workspace, autenticación, planes Stripe (monetización)
- P2: Historial de impresión / logs
- P2: Importar plantillas .prn existentes (parseando ZPL → design JSON)
- P3: Catálogo de plantillas pre-hechas para distintos rubros

## Test credentials
N/A (single-user, sin auth en MVP)
