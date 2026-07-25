# Guía de usuario y operación

Leviathan Tracker revisa páginas de productos, guarda cada resultado y envía notificaciones cuando
una regla coincide. Esta versión expone una API y Swagger; no incluye todavía una interfaz gráfica.

## 1. Conceptos

- **Product:** hardware que desea monitorear.
- **ProductSource:** URL de una tienda para ese producto.
- **ProductCheck:** resultado histórico de una revisión.
- **AlertRule:** condición como stock disponible o precio objetivo.
- **NotificationChannel:** destino Discord o webhook.
- **NotificationEvent:** intento de notificación y su resultado.

## 2. Usar Swagger

Abra <http://localhost:3000/docs>. Cada sección permite ejecutar solicitudes con `Try it out`.
También puede usar los ejemplos de esta guía reemplazando los identificadores.

## 3. Consultar el producto inicial

```powershell
$products = Invoke-RestMethod http://localhost:3000/products
$products
$productId = $products[0].id
```

Detalle:

```powershell
Invoke-RestMethod "http://localhost:3000/products/$productId"
```

## 4. Crear un producto

```powershell
$body = @{
  name = "Example GPU"
  brand = "Example"
  model = "GPU-EXAMPLE-1"
  category = "GPU"
  targetPrice = 799.99
  currency = "USD"
  enabled = $true
} | ConvertTo-Json

$product = Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/products `
  -ContentType application/json `
  -Body $body
```

Categorías: `MEMORY`, `CPU`, `GPU`, `MOTHERBOARD`, `SSD`, `PSU`, `CASE`, `MONITOR` y `OTHER`.

Actualizar parcialmente:

```powershell
Invoke-RestMethod -Method Patch `
  -Uri "http://localhost:3000/products/$($product.id)" `
  -ContentType application/json `
  -Body '{"targetPrice":749.99}'
```

Eliminar un producto también elimina sus fuentes, checks, reglas y eventos:

```powershell
Invoke-RestMethod -Method Delete -Uri "http://localhost:3000/products/PRODUCT_ID"
```

## 5. Configurar una fuente

Antes de crearla:

1. Confirme que el sitio permite el acceso automatizado.
2. Use la URL exacta del producto.
3. Inspeccione el HTML y determine selectores CSS estables.
4. Prefiera `STATIC`; use `PLAYWRIGHT` sólo si el contenido requiere JavaScript.

Ejemplo:

```powershell
$sourceBody = @{
  storeName = "Example Store"
  url = "https://store.example/products/example"
  country = "US"
  currency = "USD"
  scraperType = "STATIC"
  enabled = $false
  selectors = @{
    price = ".product-price"
    availability = "[data-testid='availability']"
    title = "h1"
    seller = ".seller-name"
  }
  metadata = @{
    notes = "Selectores verificados manualmente"
  }
} | ConvertTo-Json -Depth 5

$source = Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/products/$productId/sources" `
  -ContentType application/json `
  -Body $sourceBody
```

Manténgala deshabilitada hasta probar los selectores. Para habilitar:

```powershell
Invoke-RestMethod -Method Patch `
  -Uri "http://localhost:3000/sources/$($source.id)" `
  -ContentType application/json `
  -Body '{"enabled":true}'
```

La aplicación acepta sólo HTTP/HTTPS públicos y bloquea localhost, metadata cloud, credenciales,
rangos privados y destinos DNS internos para prevenir SSRF.

## 6. Ejecutar checks

Una fuente:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/sources/SOURCE_ID/check" `
  -ContentType application/json `
  -Body '{}'
```

Todas las fuentes habilitadas de un producto:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/products/PRODUCT_ID/check" `
  -ContentType application/json `
  -Body '{}'
```

Job global protegido:

```powershell
$token = "VALOR_DE_JOB_API_TOKEN"
Invoke-RestMethod -Method Post `
  -Uri http://localhost:3000/jobs/check-all `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType application/json `
  -Body '{}'
```

El scheduler ejecuta este mismo caso de uso según `CHECK_CRON`.

## 7. Consultar historial

```powershell
Invoke-RestMethod "http://localhost:3000/products/PRODUCT_ID/checks"
Invoke-RestMethod "http://localhost:3000/sources/SOURCE_ID/checks"
Invoke-RestMethod "http://localhost:3000/products/PRODUCT_ID/price-history"
```

Filtros disponibles:

- `from` y `to`: fecha ISO 8601;
- `store`: nombre exacto de tienda;
- `available`: `true` o `false`;
- `status`: `SUCCESS`, `FAILED` o `BLOCKED`;
- `limit`: entre 1 y 500.

Ejemplo:

```text
/products/PRODUCT_ID/checks?from=2026-07-01T00:00:00Z&available=true&status=SUCCESS&limit=50
```

## 8. Interpretar estados y errores

- `SUCCESS`: extracción completada.
- `FAILED`: timeout, selector ausente, red o estructura inesperada.
- `BLOCKED`: respuesta que sugiere bloqueo de acceso.

El scraper no evade CAPTCHA ni controles anti-bot. Si un selector deja de coincidir, revise la
página y actualice `selectors` mediante `PATCH /sources/:id`.

## 9. Reglas de alerta

El seed inicial incluye:

- `IN_STOCK`: transición de no disponible a disponible;
- `PRICE_BELOW`: precio menor o igual a 550 USD.

También están soportadas internamente:

- `PRICE_CHANGE_PERCENT`;
- `CHECK_FAILURE`.

El cooldown evita notificaciones repetidas por la misma regla, fuente y canal. La administración
REST de reglas y canales es parte del roadmap; actualmente se configuran mediante seed o Prisma.

## 10. Configurar Discord

1. En Discord, abra el canal.
2. Vaya a **Editar canal → Integraciones → Webhooks**.
3. Cree un webhook y copie su URL.
4. Guárdela sólo en `.env`:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

5. Recree la aplicación para cargar la variable:

```powershell
docker compose up -d --force-recreate app
```

6. Cree o actualice el canal en la base:

```powershell
docker compose exec app npx --yes tsx prisma/seed.ts
```

No envíe la URL a logs, GitHub o documentación pública. Si se filtra, elimine el webhook desde
Discord y cree otro.

El evento real se enviará cuando una regla coincida después de un check. El formato incluye
producto, modelo, tienda, disponibilidad, precio, URL y fecha.

## 11. Dashboard y observabilidad

```powershell
Invoke-RestMethod http://localhost:3000/dashboard
docker compose logs -f app
```

El dashboard resume productos, fuentes, precio reciente, mejor precio, disponibilidad, última
revisión, errores y alertas enviadas. Los logs incluyen request ID y duración; nunca HTML completo.

## 12. Buenas prácticas

- Empiece con una sola fuente y una frecuencia moderada.
- Verifique términos de servicio y robots.txt.
- Prefiera APIs oficiales cuando existan.
- No habilite selectores de ejemplo.
- Revise fallos consecutivos antes de aumentar reintentos.
- Mantenga backups y rote secretos.
- No exponga el puerto 3000 directamente a Internet sin autenticación, TLS y un reverse proxy.

## 13. Limitaciones actuales

- Sin UI gráfica.
- Telegram y email aún no implementados.
- Reglas y canales sin CRUD HTTP.
- Locks de URL son por proceso; múltiples réplicas requieren lock distribuido.
- Cambios de HTML requieren actualizar selectores.
- Algunos comercios bloquean scraping aunque se use Playwright.
