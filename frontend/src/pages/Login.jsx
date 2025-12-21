// frontend/src/pages/Login.jsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const DEV_LOGIN_ENABLED = import.meta.env.VITE_DEV_LOGIN === '1'

function Login() {
  const navigate = useNavigate()
  const { login, token } = useAuth()

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [devEmail, setDevEmail] = useState('')
  const [devNom, setDevNom] = useState('')
  const [devLoading, setDevLoading] = useState(false)

  // Si déjà connecté → redirection
  useEffect(() => {
    if (token) {
      navigate('/produits', { replace: true })
    }
  }, [navigate, token])

  /**
   * Callback appelé par Google Identity Services (GSI)
   * response.credential = ID token (JWT) fourni par Google
   * On l’envoie au backend pour validation + génération de token applicatif
   */
  const handleCredentialResponse = useCallback(
    async (response) => {
      if (!response?.credential) {
        setError('Réponse Google invalide.')
        return
      }

      setError('')
      setLoading(true)

      try {
        const res = await fetch(`${API_URL}/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // IMPORTANT : ton backend attend { idToken }
          body: JSON.stringify({ idToken: response.credential }),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data.error || 'Échec de l’authentification.')
        }

        // Attendu : { token, user }
        login(data.token, data.user)
        navigate('/produits', { replace: true })
      } catch (err) {
        console.error('Erreur login Google', err)
        setError(err?.message || 'Connexion impossible.')
      } finally {
        setLoading(false)
      }
    },
    [login, navigate],
  )

  /**
   * Charge le script Google GSI si nécessaire et rend le bouton
   */
  useEffect(() => {
    // Si Google n’est pas configuré et qu’on n’est pas en mode dev, on affiche l’erreur.
    if (!GOOGLE_CLIENT_ID && !DEV_LOGIN_ENABLED) {
      setError(
        'VITE_GOOGLE_CLIENT_ID manquant. Ajoutez-le dans le fichier .env du frontend.',
      )
      return
    }

    const renderButton = () => {
      if (!window.google?.accounts?.id) return

      const buttonContainer = document.getElementById('googleSignInDiv')
      if (!buttonContainer) return

      // Évite de re-render plusieurs boutons si le composant re-monte
      buttonContainer.innerHTML = ''

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      })

      window.google.accounts.id.renderButton(buttonContainer, {
        theme: 'outline',
        size: 'large',
        width: 340,
      })
    }

    // Script déjà chargé
    if (window.google?.accounts?.id) {
      renderButton()
      return
    }

    // Charger le script GSI
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderButton
    script.onerror = () =>
      setError('Impossible de charger Google SSO. Vérifiez la connexion réseau.')

    document.body.appendChild(script)

    return () => {
      // Évite d’enlever un script si plusieurs pages le partagent
      // (mais ici ça ne devrait pas poser souci)
      try {
        document.body.removeChild(script)
      } catch {
        // ignore
      }
    }
  }, [handleCredentialResponse])

  /**
   * Login dev (bypass) si activé
   */
  const handleDevLogin = async (e) => {
    e.preventDefault()
    setError('')

    if (!devEmail) {
      setError('Merci de saisir un email.')
      return
    }

    setDevLoading(true)

    try {
      const res = await fetch(`${API_URL}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: devEmail, nom: devNom }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Échec dev-login.')
      }

      login(data.token, data.user)
      navigate('/produits', { replace: true })
    } catch (err) {
      console.error('Erreur dev-login', err)
      setError(err?.message || 'Connexion dev impossible.')
    } finally {
      setDevLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl border border-slate-200 p-8 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 font-semibold">
            Lambert Gestion
          </p>

          <h1 className="text-2xl font-bold text-slate-900">
            Connexion Boulangerie
          </h1>

          <p className="text-sm text-slate-500">
            Authentification Google requise pour accéder aux données magasin.
          </p>

          {DEV_LOGIN_ENABLED && (
            <p className="text-xs text-amber-600 font-medium">
              Mode développeur activé : connexion locale disponible.
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center gap-4">
          <div id="googleSignInDiv" className="w-full flex justify-center" />

          {loading && (
            <p className="text-sm text-slate-500">Connexion en cours...</p>
          )}

          <p className="text-xs text-slate-500 text-center">
            Utilisez votre compte Google professionnel autorisé pour continuer.
          </p>
        </div>

        {DEV_LOGIN_ENABLED && (
          <div className="border-t border-slate-200 pt-4">
            <form className="space-y-3" onSubmit={handleDevLogin}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Email (dev)
                </label>
                <input
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="dev@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nom / prénom (optionnel)
                </label>
                <input
                  type="text"
                  value={devNom}
                  onChange={(e) => setDevNom(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="Jean Dupont"
                />
              </div>

              <button
                type="submit"
                disabled={devLoading}
                className="w-full rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold disabled:opacity-70"
              >
                {devLoading ? 'Connexion...' : 'Connexion dev (bypass Google)'}
              </button>

              <p className="text-xs text-slate-500">
                Route limitée au mode dev (DEV_LOGIN_ENABLED=1). À ne pas activer
                en production.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
