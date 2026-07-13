# ZebraLab — Documentación Técnica Completa

## Descripción General

ZebraLab es una aplicación web para diseñar visualmente etiquetas Zebra ZPL y enviarlas a imprimir desde Mac, sin depender de ZebraDesigner Essentials (solo disponible en Windows).

- **Marca:** BoaIdeia
- **Impresora objetivo:** Zebra ZD220 (203 dpi)
- **Stack:** FastAPI + MongoDB + React

---

## Arquitectura

```
┌─────────────────────────────────────────────┐
│              NAVEGADOR (Mac)                 │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │        React App (VPS/HTTPS)         │   │
│  │  - Editor visual canvas              │   │
│  │  - Modales: Plantillas, Lote, Vista  │   │
│  └──────────┬───────────────┬───────────┘   │
│             │               │               │
│             │ API calls      │ localhost:17331│
│             ▼               ▼               │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │  VPS Backend │  │  ZebraLab Agent     │  │
│  │  FastAPI     │  │  (Python, Mac local)│  │
│  │  :8001       │  │  → lp -d Zebra raw  │  │
│  └──────┬───────┘  └─────────────────────┘  │
│         │                                   │
│  ┌──────▼───────┐                           │
│  │   MongoDB    │                           │
│  │  (plantillas)│                           │
│  └──────────────┘                           │
└─────────────────────────────────────────────┘
```

---

## Backend (`/backend`)

### Tecnologías
- Python 3.11+
- FastAPI + Uvicorn
- Motor (MongoDB async)
- Pandas (CSV/Excel)
- Pillow (imágenes → ZPL ^GFA)
- Requests (Labelary preview API)

### Archivos principales

| Archivo | Descripción |
|---|---|
| `server.py` | API REST principal |
| `zpl_generator.py` | Convierte design JSON → ZPL II |

### Endpoints API

#### ZPL
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/zpl/generate` | Genera ZPL desde design JSON |
| POST | `/api/zpl/export` | Descarga `.prn` |
| POST | `/api/zpl/preview` | Imagen PNG via Labelary |

#### Plantillas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/templates` | Lista todas |
| POST | `/api/templates` | Crea nueva |
| PUT | `/api/templates/{id}` | Actualiza |
| DELETE | `/api/templates/{id}` | Elimina |
| POST | `/api/templates/{id}/duplicate` | Duplica |
| POST | `/api/templates/import-prn` | Importa `.prn` existente |

#### Lote
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/batch/parse` | Lee CSV/Excel, retorna columnas y filas |
| POST | `/api/batch/generate` | Genera `.prn` con todas las filas |

#### Raw ZPL (plantillas importadas)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/raw/variables` | Extrae variables `{var}` del ZPL |
| POST | `/api/raw/preview` | Vista previa PNG |
| POST | `/api/raw/export` | Descarga `.prn` con sustituciones |

#### Imágenes
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/image/upload` | Sube imagen (PNG/JPG/etc.) |
| GET | `/api/image/{id}/thumbnail` | Thumbnail para el editor |

#### Agente
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/agent/download` | Descarga `zebralab_agent.py` |

### Generador ZPL (`zpl_generator.py`)

- **Resolución:** 203 dpi → 1 mm = 8.0 dots
- **Elementos soportados:** texto, código de barras, rectángulo, línea, imagen
- **Fuentes ZPL:** 0, A, B, D, F
- **Códigos de barras:** QR, Code128, EAN-13, EAN-8, Code39, UPC-A
- **Variables:** placeholders `{nombre}` preservados en ZPL para sustitución posterior
- **Caso especial:** variable `precio` → se prefija automáticamente con `$ `
- **Imágenes:** conversión a `^GFA` (monochrome bitmap) con umbral ajustable
- **Multi-up:** grilla de N columnas × M filas con gap configurable

---

## Frontend (`/frontend`)

### Tecnologías
- React 19 (CRA + Craco)
- Tailwind CSS (paleta `brand` marrón personalizada)
- @phosphor-icons/react
- Axios

### Layout

```
┌─────────────────────────────────────────────────────┐
│                    TOP BAR                           │
│  Logo | Nombre plantilla | Preset | Dimensiones     │
│  Nuevo | Plantillas | Vista previa | Lote | Imprimir │
│  Exportar .prn | Estado agente                      │
├──────────┬──────────────────────────┬───────────────┤
│  TOOLS   │        CANVAS            │  PROPERTIES   │
│  Panel   │  (área de edición mm)    │  Panel        │
│          │                          │               │
│ Texto    │  ┌────────────────────┐  │ X, Y (mm)     │
│ Variable │  │   Etiqueta         │  │ Rotación      │
│ Code128  │  │   (drag & drop)    │  │ Fuente        │
│ EAN-13   │  └────────────────────┘  │ Tamaño        │
│ QR Code  │                          │ Datos/Variable│
│ Imagen   │  Zoom: +/-               │               │
│ Rectáng. │  Badge variables         │               │
│ Línea    │                          │               │
├──────────┴──────────────────────────┴───────────────┤
│  CAPAS (lista de elementos)                          │
└──────────────────────────────────────────────────────┘
```

### Componentes principales

| Componente | Descripción |
|---|---|
| `App.js` | Estado global, layout principal, keyboard shortcuts |
| `Canvas.jsx` | Lienzo drag & drop, soporte multi-up (grilla) |
| `ToolsPanel.jsx` | Botones para agregar elementos |
| `PropertiesPanel.jsx` | Editor de propiedades del elemento seleccionado |
| `TemplatesModal.jsx` | CRUD plantillas + importar `.prn` |
| `BatchModal.jsx` | CSV/Excel → mapeo variables → lote `.prn` |
| `PreviewModal.jsx` | Vista previa real vía Labelary + ZPL generado |
| `PrintModal.jsx` | Impresión directa vía agente local |
| `RawTemplateModal.jsx` | Usar plantillas `.prn` importadas |
| `AgentStatusBadge.jsx` | Estado conexión agente + configuración |

### Librerías (`/src/lib`)

| Archivo | Descripción |
|---|---|
| `api.js` | Todas las llamadas al backend |
| `design.js` | Presets, tipos de elemento, cálculo bounding box |
| `agent.js` | Comunicación con el agente local (localhost:17331) |

---

## Agente Local (`/companion/zebralab_agent.py`)

Servidor HTTP liviano que corre en la Mac del usuario y permite imprimir directamente desde la web app sin descargar archivos manualmente.

### Requisitos
- Python 3.7+
- macOS con CUPS instalado (incluido por defecto)
- Sin dependencias externas

### Uso
```bash
python3 zebralab_agent.py
python3 zebralab_agent.py --port 17331 --printer "Zebra_ZD220_203dpi_ZPL"
```

### Endpoints del agente
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado + lista de impresoras CUPS |
| GET | `/printers` | Lista impresoras |
| POST | `/print` | Imprime ZPL (`{"zpl":"...", "printer":"...", "copies":1}`) |

### CORS y Private Network Access
El agente implementa las cabeceras necesarias para que Chrome permita llamadas desde un dominio HTTPS (VPS) a `localhost`:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Access-Control-Request-Private-Network
Access-Control-Allow-Private-Network: true
Access-Control-Max-Age: 86400
```

> **Nota:** Chrome 104+ bloquea por defecto llamadas desde HTTPS a localhost. La cabecera `Access-Control-Allow-Private-Network: true` es obligatoria para que funcione desde el VPS.

---

## Variables de entorno

### Backend (`.env`)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=zebralab
CORS_ORIGINS=*
```

### Frontend (`.env`)
```
REACT_APP_BACKEND_URL=https://tu-dominio.com
```

---

## Despliegue en VPS

### Estructura esperada en el servidor
```
/app/
├── backend/
│   ├── server.py
│   ├── zpl_generator.py
│   └── .env
├── frontend/
│   └── build/          ← npm run build
├── companion/
│   └── zebralab_agent.py
└── docker-compose.yml
```

### Docker Compose
El proyecto incluye `docker-compose.yml` con servicios para backend, frontend y MongoDB.

```bash
docker-compose up -d
```

### Flujo de actualización
```bash
git pull
docker-compose restart backend
```

---

## Flujo de impresión

```
Usuario diseña etiqueta en el editor
        ↓
Clic en "Exportar .prn"
        ↓
Backend genera ZPL → descarga archivo .prn
        ↓
Usuario envía el .prn a la impresora:
  Opción A: python3 zebralab_print.py archivo.prn  (script original)
  Opción B: Clic en "Imprimir ahora" → agente local → lp -d Zebra raw
```

---

## Compatibilidad ZPL

El ZPL generado es compatible con:
- Zebra ZD220 (203 dpi) — impresora principal
- Cualquier impresora Zebra con soporte ZPL II

El script original del usuario (`BoaIdeia Tkinter`) usaba placeholders `{variable}` en archivos `.prn`. ZebraLab preserva este formato — los archivos exportados son 100% compatibles con el script existente.

---

## Pendiente (Backlog)

| Prioridad | Feature |
|---|---|
| P1 | Impresión directa desde VPS reconociendo agente local (CORS fix en progreso) |
| P1 | App de escritorio Mac (Tauri o Electron) |
| P2 | Multi-usuario con autenticación |
| P2 | Historial de impresión / logs |
| P2 | Monetización con Stripe |
| P3 | Catálogo de plantillas pre-hechas |
| P3 | Importar `.prn` y convertir a diseño visual editable |

---

## Repositorio

- **GitHub:** https://github.com/Macora01/zebralab.git
- **Tests backend:** `pytest backend/tests/` (12/12 passing)
