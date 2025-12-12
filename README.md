# Boulangerie Codex

## Mode dev (bypass Google)
- Suivre `docs/dev-login-setup.md` pour activer le dev-login en local (WSL ↔ Windows).
- Env dev : `DEV_LOGIN_ENABLED=1`, `VITE_DEV_LOGIN=1`, `VITE_API_URL=http://<IP_WSL>:8000`, `CORS_ORIGIN=http://localhost:5173,http://<IP_WSL>:5173`.

## Retour en prod
- Backend : `DEV_LOGIN_ENABLED=0`, `CORS_ORIGIN` = URL du front prod, `HOST/PORT` selon l’infra.
- Frontend : `VITE_DEV_LOGIN=0`, `VITE_API_URL` = URL de l’API publique.
- Redémarrer backend et frontend après modification des `.env`.
