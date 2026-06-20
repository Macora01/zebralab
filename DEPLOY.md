# 🚀 Despliegue de ZebraLab en VPS con Coolify

Esta guía cubre el despliegue completo en tu VPS Hostinger usando **Coolify**, con
auto-deploy desde GitHub, SSL automático y MongoDB embebido.

---

## 📋 Prerequisitos

- ✅ VPS con Coolify ya instalado y accesible
- ✅ Dominio `zebra.facore.cl` apuntando (registro A o CNAME) a la IP del VPS
- ✅ Cuenta de GitHub conectada a Coolify

---

## 1️⃣ Pushear el código a GitHub (desde Emergent)

En el chat de Emergent, usa el botón **"Save to GitHub"** del input. Elige:
- **Repositorio:** crea uno nuevo (privado o público) llamado `zebralab` (o el nombre que prefieras)
- **Branch:** `main`

Esto sube todo el código incluidos los archivos de despliegue (`docker-compose.yml`,
`backend/Dockerfile`, `frontend/Dockerfile`, etc.) que ya creé para ti.

---

## 2️⃣ Configurar DNS

En tu proveedor DNS (Hostinger o donde tengas `facore.cl`):

```
Type:  A
Name:  zebra
Value: <IP-pública-de-tu-VPS>
TTL:   3600
```

Espera 1-5 minutos a que propague. Verifica con:
```bash
dig +short zebra.facore.cl
```

---

## 3️⃣ Crear la aplicación en Coolify

1. Coolify → **+ New Resource** → **Application**
2. **Source:** GitHub → elige el repositorio `zebralab`
3. **Build Pack:** `Docker Compose`
4. **Branch:** `main`
5. **Base directory:** `/` (la raíz, donde está `docker-compose.yml`)

### Configurar el servicio expuesto

6. En la sección "Services" Coolify detectará automáticamente los 3 servicios:
   - `mongodb` → privado (no exponer)
   - `backend` → privado (no exponer)
   - `frontend` → **EXPONER**

7. Click en el servicio **`frontend`** → pestaña "Domains":
   - **Domain:** `https://zebra.facore.cl`
   - **Port:** `80`
   - **SSL:** activar Let's Encrypt (Coolify lo hace solo)

### Variables de entorno

8. Pestaña **"Environment Variables"** del proyecto, agrega:

| Variable | Valor |
|----------|-------|
| `REACT_APP_BACKEND_URL` | `https://zebra.facore.cl` |
| `CORS_ORIGINS` | `https://zebra.facore.cl` |
| `DB_NAME` | `zebralab` |

> ⚠ **Importante:** `REACT_APP_BACKEND_URL` se inyecta en el build del frontend
> (build arg). Si lo cambias después, debes hacer **Redeploy** (no basta restart).

### Volúmenes persistentes

9. Coolify creará automáticamente los volúmenes `mongo_data` y `uploads_data`
definidos en `docker-compose.yml`. Esto preserva la base de datos y las imágenes
subidas entre re-deploys.

---

## 4️⃣ Desplegar

10. Click en **"Deploy"** arriba a la derecha
11. Mira los logs en vivo en la pestaña "Logs"
12. Primera build tarda ~3-5 min (descarga node_modules, instala Python, etc.)

Cuando termine, abre `https://zebra.facore.cl` → deberías ver tu ZebraLab funcionando.

---

## 5️⃣ Verificación rápida

```bash
# Frontend responde HTML
curl -I https://zebra.facore.cl

# Backend responde JSON (vía proxy nginx)
curl https://zebra.facore.cl/api/

# Descargar el agente local
curl -o zebralab_agent.py https://zebra.facore.cl/api/agent/download
```

---

## 6️⃣ Conectar tu agente local de impresión

Tu Zebra ZD220 está físicamente conectada a tu Mac. La nueva URL solo cambia
de dónde sirves la web; el agente local **funciona exactamente igual**.

Solo asegúrate de descargar el agente nuevo desde la web (tiene la misma versión).

El navegador desde `https://zebra.facore.cl` podrá llamar a `http://localhost:17331`
porque los navegadores tratan `localhost` como origen seguro y permiten esa
combinación HTTPS → HTTP localhost.

---

## 🔄 Auto-deploy en cada push

Coolify por defecto vigila el branch `main`. Cada vez que pushees cambios al
repositorio, Coolify rebuildea y redepliega automáticamente.

Para forzar un deploy manual: botón **"Redeploy"** en la UI de Coolify.

---

## 🛠 Troubleshooting

### "502 Bad Gateway" al abrir la app
- El frontend está arriba pero no llega al backend.
- Revisa logs del servicio `backend` en Coolify.
- Verifica que la variable `MONGO_URL=mongodb://mongodb:27017` apunte al servicio interno.

### El backend no se conecta a MongoDB
- Asegúrate de que `mongodb` esté en estado `healthy` (Coolify lo muestra).
- `depends_on: condition: service_healthy` debería bastar; si falla, revisa el healthcheck.

### Subir imágenes funciona pero al re-deploy se pierden
- Verifica que el volumen `uploads_data` esté creado y montado en `/app/backend/uploads`.
- En Coolify: pestaña "Storages" del servicio backend.

### El agente local dice "Sin agente" desde la nueva URL
- El agente debe estar corriendo en tu Mac: `python3 ~/Documents/zebralab_agent.py`
- Recarga la web con **Cmd+Shift+R** (limpia caché del frontend).
- Si la versión del agente es vieja, descárgalo de nuevo desde la web.

### Quiero ver los logs del backend
- Coolify UI → tu aplicación → servicio `backend` → pestaña **Logs**.

### Necesito hacer backup de la base de datos
- SSH al VPS → `docker exec -it <container_mongo> mongodump --db zebralab --out /tmp/backup`
- O usa la pestaña "Backups" de Coolify si tienes la versión Pro.

---

## 📁 Estructura del repositorio

```
.
├── backend/
│   ├── Dockerfile           # Imagen Python + FastAPI
│   ├── server.py
│   ├── zpl_generator.py
│   ├── requirements.txt
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile           # Multi-stage: build React → nginx
│   ├── nginx.conf           # Sirve estáticos + proxy /api/*
│   ├── .dockerignore
│   ├── src/
│   └── package.json
├── companion/
│   ├── zebralab_agent.py    # El agente que corre en tu Mac
│   └── README.md
├── docker-compose.yml       # Orquestación de los 3 servicios
├── .env.example             # Variables de entorno (referencia)
└── DEPLOY.md                # Este archivo
```

---

## 💡 Próximos pasos sugeridos

1. **Backups automáticos** de MongoDB → usar la función nativa de Coolify
2. **Monitoring** → conectar Coolify a un Uptime Robot o similar
3. **Dominio en español tipo `etiquetas.facore.cl`** si te resulta más comercial
4. **CDN delante (Cloudflare)** para acelerar tiempos en LATAM y proteger del DDoS
