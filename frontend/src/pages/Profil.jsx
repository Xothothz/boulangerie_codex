import { useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'

function Profil() {
  const { user, token, setUser, refreshProfile, profileRefreshing } = useAuth()
  const [form, setForm] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`${API_URL}/profil/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ nom: form.nom, prenom: form.prenom }),
      })
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors de la mise à jour du profil.')
      }
      const data = await response.json()
      setUser(data.user)
      localStorage.setItem('user', JSON.stringify(data.user))
      setMessage('Profil mis à jour.')
      await refreshProfile()
    } catch (err) {
      console.error('Erreur update profil', err)
      setError(err.message || 'Impossible de mettre à jour le profil.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {(message || error) && (
        <div
          className={`px-4 py-3 rounded-lg border ${
            error
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {error || message}
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Mon profil</h2>
            <p className="text-sm text-slate-500">Modifier votre nom et prénom affichés.</p>
          </div>
          <button
            onClick={refreshProfile}
            className="text-sm text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            {profileRefreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
          </button>
        </div>
        <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prénom
            </label>
            <input
              type="text"
              value={form.prenom}
              onChange={(e) => setForm((prev) => ({ ...prev, prenom: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Prénom"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom
            </label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Nom"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 font-semibold text-sm transition disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Profil
