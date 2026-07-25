# Variables de entorno

Leviathan Tracker valida sus variables al arrancar. Para cada instalación, copie `.env.example` a
`.env` y complete los secretos localmente. El archivo `.env` está excluido de Git y no debe
compartirse entre dispositivos mediante el repositorio.

## Plantilla completa

```env
# PostgreSQL local. Docker Compose reemplaza esta URL dentro del contenedor de la aplicación.
DATABASE_URL=postgresql://leviathan:leviathan@localhost:5432/leviathan?schema=public

# Servidor HTTP
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
LOG_LEVEL=info

# Scheduler y checks
SCHEDULER_ENABLED=true
CHECK_CRON=*/30 * * * *
CHECK_CONCURRENCY=3
CHECK_TIMEOUT_MS=30000
CHECK_RETRIES=2
CHECK_FAILURE_THRESHOLD=3

# Secretos
JOB_API_TOKEN=replace-with-a-long-random-token
DISCORD_WEBHOOK_URL=

# Identificación del cliente HTTP
USER_AGENT=LeviathanTracker/1.0 (+contact@example.com)
```

En el segundo dispositivo:

```powershell
Copy-Item .env.example .env
notepad .env
```

En Linux/macOS:

```bash
cp .env.example .env
${EDITOR:-vi} .env
```

## Referencia

### `DATABASE_URL`

URL de PostgreSQL usada por Prisma.

Para ejecución local:

```env
DATABASE_URL=postgresql://leviathan:leviathan@localhost:5432/leviathan?schema=public
```

Docker Compose la sustituye automáticamente dentro de `app` por:

```text
postgresql://leviathan:leviathan@postgres:5432/leviathan?schema=public
```

No cambie `localhost` por `postgres` en `.env` salvo que ejecute comandos desde otro contenedor.
Para producción use credenciales distintas y un gestor de secretos.

### `PORT`

Puerto donde Fastify escucha dentro del proceso. Valor recomendado: `3000`. El puerto publicado
por Docker se define también en `docker-compose.yml`.

### `HOST`

Interfaz de escucha. Dentro de Docker debe ser `0.0.0.0`; `127.0.0.1` impediría publicar la API
fuera del contenedor.

### `NODE_ENV`

Valores permitidos: `development`, `test`, `production`. Para un servidor desplegado use
`production`.

### `LOG_LEVEL`

Valores permitidos: `fatal`, `error`, `warn`, `info`, `debug`, `trace` y `silent`. Use `info`
normalmente y `debug` sólo durante diagnósticos.

### `SCHEDULER_ENABLED`

`true` activa `node-cron`; `false` lo desactiva. En Cloud Run se recomienda `false` y ejecutar
`POST /jobs/check-all` desde Cloud Scheduler.

### `CHECK_CRON`

Expresión cron de cinco campos. Ejemplos:

```env
# Cada 30 minutos
CHECK_CRON=*/30 * * * *

# Cada hora
CHECK_CRON=0 * * * *

# A las 09:00 y 21:00
CHECK_CRON=0 9,21 * * *
```

Evite frecuencias agresivas y respete las condiciones de cada sitio.

### `CHECK_CONCURRENCY`

Cantidad máxima de checks simultáneos. Rango admitido: 1 a 20. Recomendado: `3`.

### `CHECK_TIMEOUT_MS`

Tiempo máximo por intento en milisegundos. Mínimo: 1000. Recomendado: `30000`.

### `CHECK_RETRIES`

Cantidad de reintentos adicionales con backoff. Rango: 0 a 5. Recomendado: `2`.

### `CHECK_FAILURE_THRESHOLD`

Fallos consecutivos requeridos para disparar `CHECK_FAILURE`. Debe ser al menos 1.

### `JOB_API_TOKEN`

Secreto Bearer para `POST /jobs/check-all`. Debe tener al menos 16 caracteres.

Generar uno en PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Generar uno en Linux/macOS:

```bash
openssl rand -base64 32
```

Cada dispositivo puede usar un token distinto. Quien invoque el endpoint debe conocer el token de
esa instalación.

### `DISCORD_WEBHOOK_URL`

URL secreta generada en Discord:

```text
https://discord.com/api/webhooks/ID/TOKEN
```

Puede usarse el mismo webhook en dos dispositivos, aunque crear uno por instalación facilita
revocación y diagnóstico. Después de agregarlo:

```powershell
docker compose up -d --force-recreate app
docker compose exec app npx --yes tsx prisma/seed.ts
```

Si el webhook se filtra, elimínelo en Discord y genere uno nuevo.

### `USER_AGENT`

Identificación enviada a páginas externas. Reemplace el contacto por una dirección real:

```env
USER_AGENT=LeviathanTracker/1.0 (+mailto:admin@example.com)
```

## Variables por escenario

### Docker local

Use la plantilla completa. Compose gestiona internamente `DATABASE_URL`.

### Node.js local

PostgreSQL debe estar disponible en la dirección de `DATABASE_URL`. Arranque con:

```powershell
node --env-file=.env dist/server.js
```

### Cloud Run

Valores recomendados:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=8080
SCHEDULER_ENABLED=false
```

Configure `DATABASE_URL`, `JOB_API_TOKEN` y `DISCORD_WEBHOOK_URL` mediante Secret Manager, no como
texto en el repositorio.

## Comprobar que `.env` no se subirá

```powershell
git check-ignore -v .env
git status --short
```

El primer comando debe mostrar la regla `.env` de `.gitignore`, y el segundo no debe listar el
archivo.
