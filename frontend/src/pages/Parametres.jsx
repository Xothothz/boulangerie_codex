import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

function Parametres() {
  const { token, logout, user } = useAuth()
  const { selectedMagasinId } = useMagasin()
  const [activeSection, setActiveSection] = useState('magasins')
  const [magasins, setMagasins] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [createForm, setCreateForm] = useState({ nom: '', code: '' })
  const [editForm, setEditForm] = useState({ id: null, nom: '', code: '' })
  const [categories, setCategories] = useState([])
  const [catLoading, setCatLoading] = useState(false)
  const [catError, setCatError] = useState('')
  const [catMessage, setCatMessage] = useState('')
  const [catCreate, setCatCreate] = useState({ nom: '', couleur: '#dbeafe' })
  const [catEdit, setCatEdit] = useState({ id: null, nom: '', couleur: '#dbeafe' })
  const [users, setUsers] = useState([])
  const [userLoading, setUserLoading] = useState(false)
  const [userError, setUserError] = useState('')
  const [userMessage, setUserMessage] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [adminError, setAdminError] = useState('')

  const fetchMagasins = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${API_URL}/magasins`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des magasins.')
      }
      const data = await response.json()
      setMagasins(data)
    } catch (err) {
      console.error('Erreur GET /magasins', err)
      setError(err.message || 'Impossible de charger les magasins.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMagasins()
  }, [])

  const fetchCategories = async () => {
    if (selectedMagasinId === null || selectedMagasinId === undefined) return
    setCatLoading(true)
    setCatError('')
    setCatMessage('')
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/categories${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des catégories.')
      }
      const data = await response.json()
      setCategories(data)
    } catch (err) {
      console.error('Erreur GET /categories', err)
      setCatError(err.message || 'Impossible de charger les catégories.')
    } finally {
      setCatLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const fetchUsers = async () => {
    setUserLoading(true)
    setUserError('')
    setUserMessage('')
    try {
      const response = await fetch(`${API_URL}/utilisateurs`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : rôle ADMIN requis.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des utilisateurs.')
      }
      const data = await response.json()
      setUsers(data)
    } catch (err) {
      console.error('Erreur GET /utilisateurs', err)
      setUserError(err.message || 'Impossible de charger les utilisateurs.')
    } finally {
      setUserLoading(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'utilisateurs') {
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!createForm.nom.trim()) {
      setError('Le nom du magasin est obligatoire.')
      return
    }
    try {
      const response = await fetch(`${API_URL}/magasins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nom: createForm.nom.trim(),
          code: createForm.code.trim() || null,
        }),
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : rôle ADMIN requis.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors de la création du magasin.')
      }
      setCreateForm({ nom: '', code: '' })
      setMessage('Magasin créé avec succès.')
      await fetchMagasins()
    } catch (err) {
      console.error('Erreur POST /magasins', err)
      setError(err.message || 'Impossible de créer le magasin.')
    }
  }

  const handleCatCreate = async (e) => {
    e.preventDefault()
    setCatError('')
    setCatMessage('')
    if (!catCreate.nom.trim()) {
      setCatError('Le nom de la catégorie est obligatoire.')
      return
    }
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/categories${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nom: catCreate.nom.trim(),
          magasinId: selectedMagasinId,
          couleur: catCreate.couleur,
        }),
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors de la création de la catégorie.')
      }
      setCatCreate({ nom: '', couleur: '#dbeafe' })
      setCatMessage('Catégorie créée.')
      await fetchCategories()
    } catch (err) {
      console.error('Erreur POST /categories', err)
      setCatError(err.message || 'Impossible de créer la catégorie.')
    }
  }

  const handleCatEditSelect = (cat) => {
    setCatEdit({
      id: cat.id,
      nom: cat.nom,
      couleur: cat.couleur || '#dbeafe',
    })
  }

  const handleCatEditSubmit = async (e) => {
    e.preventDefault()
    setCatError('')
    setCatMessage('')
    if (!catEdit.id) {
      setCatError('Sélectionnez une catégorie à modifier.')
      return
    }
    if (!catEdit.nom.trim()) {
      setCatError('Le nom de la catégorie est obligatoire.')
      return
    }
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(
        `${API_URL}/categories/${catEdit.id}${query}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            nom: catEdit.nom.trim(),
            magasinId: selectedMagasinId,
            couleur: catEdit.couleur,
          }),
        },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || 'Erreur lors de la mise à jour de la catégorie.',
        )
      }
      setCatMessage('Catégorie mise à jour.')
      await fetchCategories()
    } catch (err) {
      console.error('Erreur PUT /categories/:id', err)
      setCatError(err.message || 'Impossible de modifier la catégorie.')
    }
  }

  const handleCatDelete = async (id) => {
    setCatError('')
    setCatMessage('')
    if (!id) return
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/categories/${id}${query}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors de la suppression de la catégorie.')
      }
      setCatMessage('Catégorie supprimée (désactivée).')
      if (catEdit.id === id) {
        setCatEdit({ id: null, nom: '', couleur: '#dbeafe' })
      }
      await fetchCategories()
    } catch (err) {
      console.error('Erreur DELETE /categories/:id', err)
      setCatError(err.message || 'Impossible de supprimer la catégorie.')
    }
  }

  const handleEditSelect = (magasin) => {
    setEditForm({ id: magasin.id, nom: magasin.nom, code: magasin.code || '' })
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    if (!editForm.id) {
      setError('Sélectionnez un magasin à modifier.')
      return
    }
    if (!editForm.nom.trim()) {
      setError('Le nom du magasin est obligatoire.')
      return
    }
    try {
      const response = await fetch(`${API_URL}/magasins/${editForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nom: editForm.nom.trim(),
          code: editForm.code.trim() || null,
        }),
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : rôle ADMIN requis.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors de la mise à jour du magasin.')
      }
      setMessage('Magasin mis à jour.')
      await fetchMagasins()
    } catch (err) {
      console.error('Erreur PUT /magasins/:id', err)
      setError(err.message || 'Impossible de modifier le magasin.')
    }
  }

  const handleDelete = async (id) => {
    setError('')
    setMessage('')
    if (!id) return
    try {
      const response = await fetch(`${API_URL}/magasins/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : rôle ADMIN requis.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors de la suppression du magasin.')
      }
      setMessage('Magasin supprimé (désactivé).')
      if (editForm.id === id) {
        setEditForm({ id: null, nom: '', code: '' })
      }
      await fetchMagasins()
    } catch (err) {
      console.error('Erreur DELETE /magasins/:id', err)
      setError(err.message || 'Impossible de supprimer le magasin.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-xl border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-6 py-4 border-b border-slate-200 gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Paramètres</h2>
            <p className="text-sm text-slate-500">
              Gérer les magasins et les catégories de produits.
            </p>
          </div>
          {selectedMagasinId && (
            <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-semibold">
              Magasin courant ID #{selectedMagasinId}
            </span>
          )}
        </div>

        <div className="grid md:grid-cols-4 border-b border-slate-200">
          <button
            className={`text-left px-4 py-3 text-sm font-semibold ${
              activeSection === 'magasins'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveSection('magasins')}
          >
            Magasins
          </button>
          <button
            className={`text-left px-4 py-3 text-sm font-semibold ${
              activeSection === 'categories'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveSection('categories')}
          >
            Catégories produits
          </button>
          <button
            className={`text-left px-4 py-3 text-sm font-semibold ${
              activeSection === 'utilisateurs'
                ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveSection('utilisateurs')}
          >
            Utilisateurs
          </button>
          {user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' ? (
            <button
              className={`text-left px-4 py-3 text-sm font-semibold ${
                activeSection === 'admin'
                  ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setActiveSection('admin')}
            >
              Actions admin
            </button>
          ) : null}
        </div>

        <div className="p-6 space-y-6">
          {activeSection === 'magasins' && (
            <>
              {(error || message) && (
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

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Créer un magasin
                  </h3>
                  <form className="space-y-3" onSubmit={handleCreate}>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={createForm.nom}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, nom: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Code (optionnel)
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={createForm.code}
                        onChange={(e) =>
                          setCreateForm((prev) => ({ ...prev, code: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-sm font-semibold transition"
                    >
                      Créer
                    </button>
                  </form>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Modifier un magasin
                  </h3>
                  <form className="space-y-3" onSubmit={handleEditSubmit}>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Sélection
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.id || ''}
                        onChange={(e) => {
                          const selected = magasins.find(
                            (m) => m.id === Number(e.target.value),
                          )
                          if (selected) handleEditSelect(selected)
                        }}
                      >
                        <option value="">Choisir...</option>
                        {magasins.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nom} {m.code ? `(${m.code})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.nom}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, nom: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Code (optionnel)
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={editForm.code}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, code: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-sm font-semibold transition"
                      >
                        Mettre à jour
                      </button>
                      {editForm.id && (
                        <button
                          type="button"
                          onClick={() => handleDelete(editForm.id)}
                          className="inline-flex items-center rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-semibold transition"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="px-3 py-2 font-semibold">ID</th>
                      <th className="px-3 py-2 font-semibold">Nom</th>
                      <th className="px-3 py-2 font-semibold">Code</th>
                      <th className="px-3 py-2 font-semibold">Actif</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td className="px-3 py-4 text-center" colSpan={5}>
                          Chargement des magasins...
                        </td>
                      </tr>
                    ) : magasins.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                          Aucun magasin trouvé.
                        </td>
                      </tr>
                    ) : (
                      magasins.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 text-slate-700">{m.id}</td>
                          <td className="px-3 py-2 text-slate-900 font-medium">
                            {m.nom}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {m.code || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                m.actif
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {m.actif ? 'Oui' : 'Non'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleEditSelect(m)}
                              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                            >
                              Modifier
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeSection === 'admin' && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
            <>
              {(adminError || adminMessage) && (
                <div
                  className={`px-4 py-3 rounded-lg border ${
                    adminError
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  {adminError || adminMessage}
                </div>
              )}
              <p className="text-sm text-slate-500">
                Actions destructives (ADMIN uniquement). Utiliser avec précaution.
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    if (!window.confirm('Supprimer TOUTES les commandes ?')) return
                    try {
                      const response = await fetch(`${API_URL}/admin/purge-commandes`, {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      })
                      if (response.status === 401) {
                        logout()
                        throw new Error('Session expirée, merci de vous reconnecter.')
                      }
                      if (response.status === 403) {
                        throw new Error('Accès refusé : rôle ADMIN requis.')
                      }
                      if (!response.ok) {
                        const t = await response.text()
                        throw new Error(t || 'Erreur purge commandes')
                      }
                      setAdminMessage('Toutes les commandes ont été supprimées.')
                    } catch (err) {
                      console.error('Erreur purge commandes', err)
                      setAdminError(err.message || 'Impossible de purger les commandes.')
                    }
                  }}
                  className="w-full md:w-auto inline-flex items-center rounded-lg bg-red-700 hover:bg-red-800 text-white px-4 py-2 text-sm font-semibold transition"
                >
                  Purger toutes les commandes
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Supprimer tous les inventaires (et mouvements associés) ?')) return
                    try {
                      const response = await fetch(`${API_URL}/admin/purge-inventaires`, {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      })
                      if (response.status === 401) {
                        logout()
                        throw new Error('Session expirée, merci de vous reconnecter.')
                      }
                      if (response.status === 403) {
                        throw new Error('Accès refusé : rôle ADMIN requis.')
                      }
                      if (!response.ok) {
                        const t = await response.text()
                        throw new Error(t || 'Erreur purge inventaires')
                      }
                      setAdminMessage('Tous les inventaires ont été supprimés.')
                    } catch (err) {
                      console.error('Erreur purge inventaires', err)
                      setAdminError(err.message || 'Impossible de purger les inventaires.')
                    }
                  }}
                  className="w-full md:w-auto inline-flex items-center rounded-lg bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 text-sm font-semibold transition"
                >
                  Purger tous les inventaires
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Supprimer tous les mouvements de stock ?')) return
                    try {
                      const response = await fetch(`${API_URL}/admin/purge-mouvements`, {
                        method: 'POST',
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      })
                      if (response.status === 401) {
                        logout()
                        throw new Error('Session expirée, merci de vous reconnecter.')
                      }
                      if (response.status === 403) {
                        throw new Error('Accès refusé : rôle ADMIN requis.')
                      }
                      if (!response.ok) {
                        const t = await response.text()
                        throw new Error(t || 'Erreur purge mouvements')
                      }
                      setAdminMessage('Tous les mouvements de stock ont été supprimés.')
                    } catch (err) {
                      console.error('Erreur purge mouvements', err)
                      setAdminError(err.message || 'Impossible de purger les mouvements.')
                    }
                  }}
                  className="w-full md:w-auto inline-flex items-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold transition"
                >
                  Purger tous les mouvements de stock
                </button>
              </div>
            </>
          )}
          {activeSection === 'categories' && (
            <>
              {(catError || catMessage) && (
                <div
                  className={`px-4 py-3 rounded-lg border ${
                    catError
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  {catError || catMessage}
                </div>
              )}

              <p className="text-sm text-slate-500">
                Catégories associées au magasin courant (couleur utilisée pour les feuilles hebdo et la saisie).
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Créer une catégorie
                  </h3>
                  <form className="space-y-3" onSubmit={handleCatCreate}>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={catCreate.nom}
                        onChange={(e) =>
                          setCatCreate((prev) => ({ ...prev, nom: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Couleur (pastel)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          className="h-10 w-16 rounded border border-slate-200"
                          value={catCreate.couleur}
                          onChange={(e) =>
                            setCatCreate((prev) => ({ ...prev, couleur: e.target.value }))
                          }
                        />
                        <span className="text-xs text-slate-500">{catCreate.couleur}</span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-sm font-semibold transition"
                    >
                      Créer
                    </button>
                  </form>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Modifier une catégorie
                  </h3>
                  <form className="space-y-3" onSubmit={handleCatEditSubmit}>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Sélection
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={catEdit.id || ''}
                        onChange={(e) => {
                          const selected = categories.find(
                            (c) => c.id === Number(e.target.value),
                          )
                          if (selected) handleCatEditSelect(selected)
                        }}
                      >
                        <option value="">Choisir...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nom
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        value={catEdit.nom}
                        onChange={(e) =>
                          setCatEdit((prev) => ({ ...prev, nom: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Couleur (pastel)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          className="h-10 w-16 rounded border border-slate-200"
                          value={catEdit.couleur}
                          onChange={(e) =>
                            setCatEdit((prev) => ({ ...prev, couleur: e.target.value }))
                          }
                          disabled={!catEdit.id}
                        />
                        <span className="text-xs text-slate-500">
                          {catEdit.couleur}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-sm font-semibold transition"
                      >
                        Mettre à jour
                      </button>
                      {catEdit.id && (
                        <button
                          type="button"
                          onClick={() => handleCatDelete(catEdit.id)}
                          className="inline-flex items-center rounded-lg bg-red-600 hover:bg-red-700 text-white px-3 py-2 text-sm font-semibold transition"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="px-3 py-2 font-semibold">ID</th>
                      <th className="px-3 py-2 font-semibold">Nom</th>
                      <th className="px-3 py-2 font-semibold">Couleur</th>
                      <th className="px-3 py-2 font-semibold">Actif</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catLoading ? (
                      <tr>
                        <td className="px-3 py-4 text-center" colSpan={5}>
                          Chargement des catégories...
                        </td>
                      </tr>
                    ) : categories.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                          Aucune catégorie trouvée.
                        </td>
                      </tr>
                    ) : (
                      categories.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 text-slate-700">{c.id}</td>
                          <td className="px-3 py-2 text-slate-900 font-medium">
                            {c.nom}
                          </td>
                          <td className="px-3 py-2">
                            {c.couleur ? (
                              <span className="inline-flex items-center gap-2 text-xs text-slate-700">
                                <span
                                  className="h-4 w-4 rounded border border-slate-200 inline-block"
                                  style={{ backgroundColor: c.couleur }}
                                />
                                {c.couleur}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                c.actif
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {c.actif ? 'Oui' : 'Non'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleCatEditSelect(c)}
                              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                            >
                              Modifier
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeSection === 'utilisateurs' && (
            <>
              {(userError || userMessage) && (
                <div
                  className={`px-4 py-3 rounded-lg border ${
                    userError
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  {userError || userMessage}
                </div>
              )}

              <p className="text-sm text-slate-500 mb-3">
                Affecter un utilisateur à un magasin (réservé aux administrateurs).
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                      <th className="px-3 py-2 font-semibold">Nom</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Rôle</th>
                      <th className="px-3 py-2 font-semibold">Magasin</th>
                      <th className="px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userLoading ? (
                      <tr>
                        <td className="px-3 py-4 text-center" colSpan={5}>
                          Chargement des utilisateurs...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                          Aucun utilisateur.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 text-slate-900 font-medium">{u.nom}</td>
                          <td className="px-3 py-2 text-slate-700">{u.email}</td>
                          <td className="px-3 py-2 text-slate-700">{u.role}</td>
                          <td className="px-3 py-2 text-slate-700">
                            <select
                              value={u.magasinId || ''}
                              onChange={(e) =>
                                setUsers((prev) =>
                                  prev.map((x) =>
                                    x.id === u.id
                                      ? { ...x, magasinId: e.target.value ? Number(e.target.value) : null }
                                      : x,
                                  ),
                                )
                              }
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm"
                            >
                              <option value="">Aucun</option>
                              {magasins.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nom}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `${API_URL}/utilisateurs/${u.id}/magasin`,
                                    {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                      },
                                      body: JSON.stringify({ magasinId: u.magasinId }),
                                    },
                                  )
                                  if (response.status === 401) {
                                    logout()
                                    throw new Error('Session expirée, merci de vous reconnecter.')
                                  }
                                  if (response.status === 403) {
                                    throw new Error('Accès refusé : rôle ADMIN requis.')
                                  }
                                  if (!response.ok) {
                                    const errorText = await response.text()
                                    throw new Error(
                                      errorText ||
                                        'Erreur lors de la mise à jour du magasin utilisateur.',
                                    )
                                  }
                                  setUserMessage('Affectation mise à jour.')
                                  await fetchUsers()
                                } catch (err) {
                                  console.error('Erreur PUT /utilisateurs/:id/magasin', err)
                                  setUserError(err.message || 'Impossible de mettre à jour.')
                                }
                              }}
                            >
                              Enregistrer
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Parametres
