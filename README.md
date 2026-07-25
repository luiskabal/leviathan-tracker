# Leviathan Tracker

Servicio para monitorear precio, stock y salud de páginas de hardware. La primera configuración
incluye la memoria G.Skill `F5-6000J3444F64GX2-TZ5NR`, pero el dominio admite cualquier categoría.

## Arquitectura

Fastify expone la API y reutiliza `CheckService` tanto para checks manuales como para cron. El
servicio selecciona un scraper estático (Cheerio) o dinámico (Playwright), registra siempre el
resultado en PostgreSQL, evalúa reglas y despacha eventos a adaptadores Discord/webhook.

```text
src/
  config/                 entorno validado
  modules/
    alerts/               reglas puras
    checks/               caso de uso de monitoreo
    http/                 validación y rutas
  providers/
    scrapers/             Cheerio, Playwright y registro extensible
    notifications/        Discord y webhook
  jobs/                   adaptador node-cron
  shared/                 Prisma, errores, precio, stock y SSRF
prisma/                   esquema y seed
tests/                    unitarios, fixture local y API
```

Decisiones: precios en `Decimal(14,2)`; selectores como JSON; fallos también son historial;
concurrencia global con `p-limit`; una promesa compartida evita checks simultáneos de la misma URL.
Telegram y email quedan expresamente como adaptadores pendientes.

## Requisitos

Node.js 22, npm, PostgreSQL 16 y, para fuentes dinámicas, Chromium de Playwright. Docker es la
opción más simple.

## Inicio local

```bash
cp .env.example .env
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npx playwright install chromium
npm run dev
```

Swagger queda en `http://localhost:3000/docs`. Salud y disponibilidad están en `/health` y
`/ready`.

## Docker Compose

```bash
cp .env.example .env
docker compose up --build
docker compose exec app npm run prisma:seed
```

El contenedor ejecuta `prisma db push --skip-generate` antes de arrancar para facilitar la primera
versión. PostgreSQL usa un volumen persistente. En producción, genere y versiona una migración con
`prisma migrate dev` y cambie el arranque a `prisma migrate deploy`.

## Migraciones y seed

En desarrollo, `npm run prisma:migrate -- --name <nombre>`. En producción,
`npx prisma migrate deploy`. El seed crea el producto, reglas `IN_STOCK` y
`PRICE_BELOW=550 USD`, y cinco fuentes **deshabilitadas**. Sus URL/selectores son marcadores y no
se afirman como válidos: reemplácelos y habilite la fuente sólo después de verificar el sitio.

## Discord

Crear un webhook en el canal, asignarlo a `DISCORD_WEBHOOK_URL` y ejecutar el seed. También puede
crearse un `NotificationChannel` de tipo `DISCORD` cuya configuración sea:

```json
{ "url": "https://discord.com/api/webhooks/..." }
```

La URL es secreta: no se devuelve deliberadamente en logs. Para producción conviene gestionarla
con Secret Manager.

## Productos, fuentes y selectores

Crear un producto:

```bash
curl -X POST http://localhost:3000/products -H "content-type: application/json" \
  -d '{"name":"Example GPU","model":"GPU-1","category":"GPU","currency":"USD"}'
```

Agregar una fuente con el ID devuelto:

```bash
curl -X POST http://localhost:3000/products/PRODUCT_ID/sources \
  -H "content-type: application/json" \
  -d '{"storeName":"Store","url":"https://store.example/product","country":"US","currency":"USD","scraperType":"STATIC","selectors":{"price":".price","availability":"#stock"}}'
```

Los valores de `selectors` son selectores CSS. `price` y `availability` son recomendados;
`title` y `seller` son opcionales. Para páginas renderizadas con JavaScript usar
`PLAYWRIGHT`. Un selector que deja de coincidir se registra como fallo de estructura.

## Ejecutar checks e historial

```bash
curl -X POST http://localhost:3000/sources/SOURCE_ID/check
curl http://localhost:3000/products/PRODUCT_ID/price-history
curl "http://localhost:3000/products/PRODUCT_ID/checks?status=SUCCESS&available=true"
curl -X POST http://localhost:3000/jobs/check-all \
  -H "authorization: Bearer $JOB_API_TOKEN"
```

Los historiales aceptan `from`, `to`, `store`, `available`, `status` y `limit`. El endpoint de job
queda inutilizable si `JOB_API_TOKEN` está vacío.

## Cloud Run y Cloud Scheduler

Construir la imagen, publicarla en Artifact Registry y desplegarla con `PORT=3000`,
`SCHEDULER_ENABLED=false`, `DATABASE_URL` a Cloud SQL y secretos desde Secret Manager. La instancia
necesita salida a Internet y acceso a la base. Aplicar migraciones desde CI o un Cloud Run Job.

Crear un Cloud Scheduler HTTP Job que haga `POST` a `/jobs/check-all` y agregue
`Authorization: Bearer <JOB_API_TOKEN>`. No habilitar simultáneamente cron interno y Scheduler si
se quiere evitar ejecuciones duplicadas. Para autenticación fuerte, el siguiente paso recomendado
es validar tokens OIDC de Scheduler además del token compartido.

## Seguridad y operación

Se aceptan sólo URL HTTP(S) sin credenciales. Se bloquean hostnames internos, loopback, link-local,
rangos privados y resoluciones DNS privadas antes de descargar. Las redirecciones del scraper
estático están deshabilitadas para impedir saltos SSRF. Hay rate limit, timeout, reintentos con
backoff, concurrencia acotada, request ID y logs Pino con redacción.

No se intenta resolver CAPTCHA ni evadir anti-bot. Revise robots.txt, términos de servicio,
licencias, normativa local y frecuencia permitida de cada comercio. Cuando exista una API oficial,
debe preferirse. El HTML completo nunca se persiste ni registra.

## Calidad

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Los tests usan HTML local y no llaman páginas reales. CI ejecuta la misma secuencia.

## Roadmap

- Adaptadores Telegram y email.
- Autenticación OIDC para Cloud Scheduler y administración.
- Métricas Prometheus/OpenTelemetry.
- Proveedores oficiales por tienda y seguimiento de redirects seguro.
- Locks distribuidos para múltiples réplicas.
- UI web y gestión REST de reglas/canales.
