## Dev login (bypass Google) en local (WSL ↔ Windows)

1) Démarrer la DB : `docker compose up -d db` (ajoute `sudo` si nécessaire).
2) Backend :
   - Env clés (`backend/.env`) :
     - `HOST=0.0.0.0`
     - `PORT=8000`
     - `DATABASE_URL="postgresql://boulange:boulange_password@localhost:5434/boulangerie_db"`
     - `DEV_LOGIN_ENABLED=1`
     - `CORS_ORIGIN=http://localhost:5173,http://<IP_WSL>:5173`
   - Lancer : `npm run dev` (depuis `backend/`).
   - Vérifs : `ss -tlnp | grep 8000`, `curl http://localhost:8000/health`.
3) Frontend :
   - Récupérer l’IP WSL : `ip -o -4 addr show scope global | awk '{print $4}' | cut -d/ -f1`
   - Env (`frontend/.env`) :
     - `VITE_API_URL=http://<IP_WSL>:8000`
     - `VITE_DEV_LOGIN=1`
   - Lancer : `npm run dev -- --host` (depuis `frontend/`).
4) Test :
   - Ouvrir http://localhost:5173
   - Bouton “Connexion dev (bypass Google)” doit fonctionner.
   - Si besoin, POST manuel : `curl -i -X POST http://<IP_WSL>:8000/auth/dev-login -H "Content-Type: application/json" -d '{"email":"test@example.com","nom":"Test"}'`

Notes :
- Le 403 Google SSO est normal en dev (origine non autorisée), mais n’impacte pas le dev-login.
- Pense à redémarrer backend/front après modification des `.env`.
