# ZebraLab Agent — Imprimir directo desde la web app

Pequeño servidor local que corre en tu Mac y le permite a la web app **ZebraLab**
imprimir directamente en tu impresora Zebra ZD220, sin tener que descargar
archivos `.prn` manualmente.

## 🚀 Inicio rápido (60 segundos)

### 1. Descarga el agente
Guarda `zebralab_agent.py` en una carpeta cómoda, por ejemplo:
```
~/Documents/zebralab/zebralab_agent.py
```

### 2. Verifica el nombre de tu impresora
Abre Terminal y ejecuta:
```bash
lpstat -p | awk '{print $2}'
```
Verás algo como `Zebra_Technologies_ZTC_ZD220_203dpi_ZPL`. Copia el nombre exacto.

### 3. Inicia el agente

**Opción A — Con el nombre por defecto (más común):**
```bash
python3 ~/Documents/zebralab/zebralab_agent.py
```

**Opción B — Especificando tu impresora:**
```bash
python3 ~/Documents/zebralab/zebralab_agent.py --printer "Zebra_Technologies_ZTC_ZD220_203dpi_ZPL"
```

Verás algo así:
```
  ▒▓█ ZebraLab Agent v1.0.0 █▓▒
      Escuchando en:    http://localhost:17331
      Impresora default: Zebra_Technologies_ZTC_ZD220_203dpi_ZPL
      CUPS detectó: Zebra_Technologies_ZTC_ZD220_203dpi_ZPL
```

### 4. Abre la web app
Ve a https://iniciar-proyecto.preview.emergentagent.com

Verás en la barra superior un **punto verde "Agente conectado"** → ya puedes
usar el botón **"Imprimir ahora"** 🟢

---

## ⚙ Auto-arranque al iniciar tu Mac (opcional)

Para no tener que abrir la terminal cada vez:

### Crear un launcher (.command)

1. Crea un archivo `~/Documents/zebralab/start_agent.command` con este contenido:
```bash
#!/bin/bash
cd "$(dirname "$0")"
python3 zebralab_agent.py
```

2. Dale permisos:
```bash
chmod +x ~/Documents/zebralab/start_agent.command
```

3. Ahora basta con **doble-clic** sobre `start_agent.command` para iniciar.

### Agregar al inicio de sesión

System Settings → General → Login Items → **+** → elige `start_agent.command`.

---

## 🛠 Endpoints (para desarrolladores)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado + lista de impresoras CUPS |
| GET | `/printers` | Sólo lista de impresoras |
| POST | `/print` | Body: `{"zpl": "^XA...^XZ", "printer": "...", "copies": 1}` |

Ejemplo de prueba:
```bash
curl -X POST http://localhost:17331/print \
  -H "Content-Type: application/json" \
  -d '{"zpl":"^XA^FO20,20^ADN,36,20^FDTest!^FS^XZ"}'
```

---

## ❓ Problemas comunes

**"lp: not found"** → No tienes CUPS instalado (debería venir por defecto en macOS).

**"client-error-not-found"** al imprimir → El nombre de la impresora no coincide.
Verifica con `lpstat -p` y vuelve a iniciar el agente con `--printer "nombre_exacto"`.

**El navegador muestra "Agente desconectado"** aunque el agente esté corriendo:
- Verifica que veas "Escuchando en: http://localhost:17331" en la terminal
- Si usaste un puerto distinto, configúralo en la web app (icono de ajustes)
- Cierra y reabre el agente

**Quiero usar otro puerto:**
```bash
python3 zebralab_agent.py --port 8765
```
Luego ajusta el puerto en la web app (icono ⚙ junto al estado del agente).

---

## 🔒 Seguridad

- El agente escucha **sólo en `127.0.0.1`** (no es accesible desde la red local)
- No tiene autenticación porque sólo procesos en tu Mac pueden alcanzarlo
- Acepta CORS de cualquier origen para que la web app pueda llamarlo

Si te preocupa la seguridad en una Mac compartida, no dejes el agente corriendo cuando no lo uses.
