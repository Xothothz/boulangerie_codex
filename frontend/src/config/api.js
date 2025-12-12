// frontend/src/config/api.js
// URL de base de l'API backend.
// - En dev (vite), on cible localhost:8000 par défaut.
// - En prod, on retombe sur l'URL publique si VITE_API_URL n'est pas fourni.
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:8000'
    : 'https://boulangerie-lambert.fr/api');
