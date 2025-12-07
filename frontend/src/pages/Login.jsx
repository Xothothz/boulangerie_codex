import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

function Login() {
  const navigate = useNavigate()
  const { login, token } = useAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) {
      navigate('/produits', { replace: true })
    }
  }, [navigate, token])

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
          body: JSON.stringify({ idToken: response.credential }),
        })

        const data = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(data.error || 'Échec de l’authentification.')
        }

        login(data.token, data.user)
        navigate('/produits', { replace: true })
      } catch (err) {
        console.error('Erreur login Google', err)
        setError(err.message || 'Connexion impossible.')
      } finally {
        setLoading(false)
      }
    },
    [login, navigate],
  )

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError(
        'VITE_GOOGLE_CLIENT_ID manquant. Ajoutez-le dans le fichier .env du frontend.',
      )
      return
    }

    const renderButton = () => {
      if (!window.google?.accounts?.id) return
      const buttonContainer = document.getElementById('googleSignInDiv')
      if (!buttonContainer) return
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

    if (window.google?.accounts?.id) {
      renderButton()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderButton
    script.onerror = () =>
      setError('Impossible de charger Google SSO. Vérifiez la connexion réseau.')
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [handleCredentialResponse])

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
      </div>
    </div>
  )
}

export default Login
