# Informe Final — Auditoría y Refactorización (2026-08-16)

## Alcance

Sobre el CRM MVP **Trebor Zernio** (JS vanilla + Vue CDN, sin build): auditoría extensa de estructura/código/seguridad y aplicación de las mejoras de **bajo riesgo** priorizadas. Todo bajo revisión de código obligatoria antes de cada merge.

## Convenciones respetadas

- Ramas: `fix/<area>`, `refactor/<tema>` (nomenclatura de github).
- Commits: convencionales (`fix:`, `refactor:`, `docs:`) y atómicos ≤ 1400 líneas.
- Código limpio, DRY, seguimiento de constantes, condicionales minimizados.
- La `MASTER_API_KEY` se dejó **intacta** (decisión del usuario), solo documentada.

---

## 1. Seguridad (rama `fix/security-webhook-auth`)

| ID | Fix | Detalle |
|---|---|---|
| **A1** | `GET /webhooks/events` solo loopback | Guardia 403 para peticiones no locales. |
| **C2** | Secret de webhook por header | `X-Zernio-Secret` preferido, query como fallback; el valor nunca se loguea. |
| **A2** | Proxy `/zernio/*` endurecido | Rutas admin bloqueadas fuera de loopback, con detección de túnel por `Host` y `isAdminApiPath` robusto (query + percent-encoding). |
| **C1** | ⚠️ Master key documentada | Todo `docs(server)` — NO se tocó la key (decisión del usuario). |

**Detección de túnel (hallazgo de revisión):** `isLoopback` por `socket.remoteAddress` era insuficiente porque `cloudflared`/`ngrok` corren en la misma máquina. Se combinó con `isLocalHost` (Host header) → `isLocalRequest = isLoopback && isLocalHost`.

Quedó pendiente (fuera de alcance, a revocar por el proveedor): la `MASTER_API_KEY` hardcodeada en `src/services/zernio-api.js:21`.

---

## 2. Refactorización (DRY, sin cambiar comportamiento)

### 2.1 `refactor/dedupe-shared-helpers`
- **`makeCloseLead()`** — flujo "cierre de lead" duplicado (~80 líneas en `inbox.js` + `leads.js`) extraído a fábrica compartida en `src/shared.js`.
- **`makeLogoUpload()`** — upload/redimensionado de logo duplicado (`settings.js` + `onboarding.js`) centralizado, con callbacks de destino.

### 2.2 `refactor/date-helpers`
- Ayudantes `fmtDT()`, `fmtD()`, `fmtT()` en `constants.js`.
- Sustituidos 20+ `toLocaleString/DateString/TimeString('es-VE')` inline en 7 componentes.
- Sin tocar: formatos numéricos (miles) ni variantes con opciones (dashboard/analytics).

### 2.3 `refactor/api-persistence`
- **M2** — 6 wrappers de API (`getUsageRobust`, `getBillingOrNull`, `*OrEmpty`, …) que internalizan los `.catch(() => fallback)` repetidos.
- **M4** — `productMentionsFor(workspace)` único (3 computeds duplicadas eliminadas).
- **M1** — debounce *trailing* de 350ms en la persistencia del workspace + `flush()` en `beforeunload`/`visibilitychange` (sin pérdida de datos al cerrar pestaña).

---

## 3. Resultado neto

- **~160 líneas deduplicadas/consolidadas** sin cambiar una sola salida visible.
- **0 errores de consola** en smoke tests; `node --check` verde en todos los archivos tocados.
- **12 commits** + 4 merges sobre `main`, todos pusheados a `origin`.

### Historial (main)
```
5334350 merge: refactor/api-persistence (M2+M4+M1)
48ba55a refactor(storage): debounce 350ms persistencia
1046b5b refactor(products): productMentionsFor()
11d4b75 refactor(api): wrappers fallback API
c5651df merge: refactor/date-helpers (fmtDT/fmtD/fmtT)
95f0a75 merge: refactor/dedupe-shared-helpers
f79e128 merge: fix/security-webhook-auth (A1+C2+A2)
2619544 docs: informe de auditoría + diagramas
```

---

## 4. Pendientes sugeridos (NO realizados)

Riesgo medio/alto o de mayor alcance, listados para decisión futura:
1. **Revocar/rotar la `MASTER_API_KEY`** en el dashboard de Zernio (seguridad real).
2. Extraer los catálogos de `constants.js` a `src/data/catalog.js` + helpers a `src/utils.js` (god-file).
3. Separar responsabilidades de `inbox.js`/`broadcasts.js`/`settings.js` en composables.
4. Posible endurecimiento futuro del regex de rutas admin con flag `i` (case-insensitive).

---

## Entregables de documentación
- `docs/AUDIT-REPORT.md` — informe de auditoría (4 frentes).
- `docs/architecture-audit.md` + `docs/architecture-*.svg` — diagramas de arquitectura/dependencias/webhook.