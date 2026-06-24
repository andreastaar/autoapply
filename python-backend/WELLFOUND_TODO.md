# Wellfound Integration — Guardado para después

## Status
Wellfound usa DataDome CAPTCHA en páginas HTML.
`curl_cffi` bypasa las rutas de API (devuelven 404 - no bloqueadas)
pero las páginas HTML siguen dando 403.

## Lo que funciona
- `curl_cffi` con `impersonate="chrome120"` → bypasa TLS fingerprint
- `/api/v1/jobs*` endpoints → 404 (no existen pero NO están bloqueados)
- GraphQL → 403 (protegido)

## Próximos pasos para desbloquearlo
1. **CapSolver API** (~$1/1000 solves) — https://capsolver.com
   - Detecta y resuelve DataDome automáticamente
   - Integrar en el fetch con token en headers

2. **API mobile** — Wellfound app iOS/Android usa endpoints menos protegidos
   - Inspeccionar con Proxyman/Charles cuál es la URL real

3. **curl_cffi + cookies reales** — loguearse a mano una vez, exportar cookies,
   usarlas en todas las requests (las cookies pasan DataDome)

## Code template
```python
from curl_cffi import requests
session = requests.Session(impersonate="chrome120")
# With CapSolver token in cookies:
session.cookies.set("dd_cookie_test", "<token_from_capsolver>", domain=".wellfound.com")
r = session.get("https://wellfound.com/jobs?role=data-engineer")
```

## Empresas únicas en Wellfound (no están en GH/Ashby/Lever)
- Early-stage AI startups (pre-Series A)
- Companies that ONLY post on Wellfound
- YC W24/S24 batch companies (some overlap with YC HN)
