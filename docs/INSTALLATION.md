# Guía de instalación

Esta guía deja Leviathan Tracker ejecutándose con Node.js 22, PostgreSQL 16 y Chromium dentro de
Docker. Es el método recomendado para desarrollo, pruebas y uso en una estación de trabajo.

## 1. Requisitos

- Windows 10/11, macOS o Linux de 64 bits.
- Docker Desktop en Windows/macOS, o Docker Engine con Compose en Linux.
- Virtualización habilitada en BIOS/UEFI cuando Docker Desktop use WSL 2.
- Git para clonar el repositorio.
- Al menos 4 GB de RAM disponibles y aproximadamente 3 GB de disco para imágenes y navegador.
- Acceso a Internet durante el primer build.

Node.js y PostgreSQL no necesitan instalarse en el host: las versiones requeridas se incluyen en
los contenedores.

Compruebe Docker:

```powershell
docker version
docker compose version
```

En Windows, `wsl --status` debe indicar versión predeterminada 2.

## 2. Obtener el proyecto

```powershell
git clone https://github.com/luiskabal/leviathan-tracker.git
cd leviathan-tracker
```

Si ya existe el checkout:

```powershell
git pull --ff-only
```

## 3. Configurar variables

Copie la plantilla; `.env` está excluido de Git:

```powershell
Copy-Item .env.example .env
```

En Bash:

```bash
cp .env.example .env
```

Edite como mínimo:

```env
JOB_API_TOKEN=reemplace-por-un-token-aleatorio-de-al-menos-16-caracteres
DISCORD_WEBHOOK_URL=
```

Consulte la [referencia completa de variables](ENVIRONMENT.md), que incluye una plantilla lista
para copiar, generación de secretos y diferencias entre Docker y ejecución local.

Variables principales:

| Variable | Propósito | Valor inicial |
| --- | --- | --- |
| `PORT` | Puerto HTTP publicado | `3000` |
| `SCHEDULER_ENABLED` | Activa cron interno | `true` |
| `CHECK_CRON` | Expresión cron | `*/30 * * * *` |
| `CHECK_CONCURRENCY` | Checks simultáneos máximos | `3` |
| `CHECK_TIMEOUT_MS` | Timeout por intento | `30000` |
| `CHECK_RETRIES` | Reintentos con backoff | `2` |
| `CHECK_FAILURE_THRESHOLD` | Fallos consecutivos para alerta | `3` |
| `JOB_API_TOKEN` | Bearer token de `/jobs/check-all` | obligatorio |
| `DISCORD_WEBHOOK_URL` | Webhook secreto de Discord | opcional |

No agregue `.env` al repositorio ni copie sus valores en tickets, logs o capturas.

## 4. Construir y arrancar

```powershell
docker compose up --build -d
docker compose ps
```

La primera compilación descarga Chromium y puede tardar varios minutos. El resultado esperado es:

- `postgres`: `healthy`;
- `app`: `Up`;
- puerto `3000` publicado.

## 5. Cargar datos iniciales

El seed es idempotente y puede ejecutarse más de una vez:

```powershell
docker compose exec app npx --yes tsx prisma/seed.ts
```

Crea:

- G.Skill Trident Z5 Neo RGB 128 GB;
- reglas `IN_STOCK` y `PRICE_BELOW = 550 USD`;
- cinco fuentes de ejemplo deshabilitadas;
- canal Discord si `DISCORD_WEBHOOK_URL` tiene valor.

Las URL y los selectores del seed son ejemplos. No habilite una fuente sin reemplazarlos.

## 6. Validar la instalación

Abra:

- API: <http://localhost:3000>
- Swagger: <http://localhost:3000/docs>
- Health: <http://localhost:3000/health>
- Readiness: <http://localhost:3000/ready>
- Dashboard: <http://localhost:3000/dashboard>

Comprobación por PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/ready
Invoke-RestMethod http://localhost:3000/products
```

Se espera `status: ok`, `status: ready` y al menos el producto inicial después del seed.

## 7. Operación cotidiana

```powershell
# Estado
docker compose ps

# Logs de aplicación
docker compose logs -f app

# Reiniciar
docker compose restart

# Detener conservando datos
docker compose down

# Volver a iniciar
docker compose up -d
```

No ejecute `docker compose down -v` salvo que quiera eliminar definitivamente la base Docker.

## 8. Actualizar la aplicación

```powershell
git pull --ff-only
docker compose up --build -d
docker compose exec app npx --yes tsx prisma/seed.ts
docker compose ps
```

Revise `/health`, `/ready` y los logs después de cada actualización.

## 9. Backup y restauración

Crear backup:

```powershell
docker compose exec -T postgres pg_dump -U leviathan -d leviathan -Fc > leviathan.dump
```

Restaurar sobre una base vacía:

```powershell
Get-Content -AsByteStream leviathan.dump |
  docker compose exec -T postgres pg_restore -U leviathan -d leviathan --clean --if-exists
```

Guarde los backups fuera del repositorio y protéjalos como datos sensibles.

## 10. Solución de problemas

### Puerto 3000 ocupado

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

Detenga la aplicación conflictiva o cambie el mapeo de puertos en `docker-compose.yml`.

### PostgreSQL no está healthy

```powershell
docker compose logs postgres
docker compose restart postgres
```

### La aplicación reinicia

```powershell
docker compose logs app --tail 200
docker compose up --build -d
```

### Docker Desktop no arranca en Windows

Active Intel VT-x/AMD-V en BIOS, habilite WSL 2 y Virtual Machine Platform, reinicie Windows y
compruebe `wsl --status`.

### Restablecer completamente el entorno Docker

Esta acción elimina toda la base:

```powershell
docker compose down -v
docker compose up --build -d
docker compose exec app npx --yes tsx prisma/seed.ts
```

## 11. Instalación sin Docker

Requiere Node.js 22, PostgreSQL 16 y Chromium de Playwright:

```powershell
npm ci
npm run prisma:generate
npx prisma db push
npm run prisma:seed
npx playwright install chromium
node --env-file=.env dist/server.js
```

Antes del último comando ejecute `npm run build`. Ajuste `DATABASE_URL` para apuntar a PostgreSQL
local. Para uso normal se recomienda Docker, que reduce diferencias entre entornos.
