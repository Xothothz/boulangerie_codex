import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

function Parametres() {
  const { token, logout, user } = useAuth()
  const { selectedMagasinId } = useMagasin()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
  const hasPerm = (code) =>
    isAdmin ||
    user?.permissions?.includes('*') ||
    user?.permissions?.includes(code)
  const [activeSection, setActiveSection] = useState('magasins')
  const [magasins, setMagasins] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const emptyDays = () => ({
    joursCommande: [],
    delaisLivraison: {},
  })
  const [createForm, setCreateForm] = useState({ nom: '', code: '', ...emptyDays() })
  const [editForm, setEditForm] = useState({ id: null, nom: '', code: '', ...emptyDays() })
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
  const [permDefs, setPermDefs] = useState({ permissions: [], groups: [] })
  const [permLoading, setPermLoading] = useState(false)
  const [permError, setPermError] = useState('')
  const [permMessage, setPermMessage] = useState('')
  const [permSelectedUserId, setPermSelectedUserId] = useState('')
  const [permSelected, setPermSelected] = useState([])
  const [logs, setLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState('')
  const [logsFilters, setLogsFilters] = useState({
    limit: 50,
    action: '',
    q: '',
    success: 'all',
    magasinId: '',
  })

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

  const fetchAuditLogs = async () => {
    setLogsLoading(true)
    setLogsError('')
    try {
      const params = new URLSearchParams()
      params.set('limit', logsFilters.limit || 50)
      if (logsFilters.action) params.set('action', logsFilters.action)
      if (logsFilters.q) params.set('q', logsFilters.q)
      if (logsFilters.magasinId) params.set('magasinId', logsFilters.magasinId)
      if (logsFilters.success === 'true' || logsFilters.success === 'false') {
        params.set('success', logsFilters.success)
      }
      const response = await fetch(`${API_URL}/admin/audit-logs?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : permission audit:read requise.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors du chargement des logs.')
      }
      const data = await response.json()
      setLogs(data.items || [])
    } catch (err) {
      console.error('Erreur GET /admin/audit-logs', err)
      setLogsError(err.message || 'Impossible de charger les logs.')
    } finally {
      setLogsLoading(false)
    }
  }

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

  useEffect(() => {
    if (activeSection === 'permissions' && hasPerm('permissions:manage')) {
      if (permDefs.permissions.length === 0) {
        fetchPermissionDefinitions()
      }
      if (users.length === 0 && !userLoading) {
        fetchUsers()
      }
    }
    if (activeSection === 'logs' && hasPerm('audit:read') && !logsLoading && logs.length === 0) {
      fetchAuditLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

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
        throw new Error('Accès refusé : permission requise.')
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
    if (activeSection === 'utilisateurs' && (hasPerm('utilisateurs:list') || hasPerm('permissions:manage'))) {
      fetchUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const formatDateTime = (value) => {
    try {
      return new Date(value).toLocaleString('fr-FR')
    } catch (e) {
      return value
    }
  }

  const detailsPreview = (details) => {
    if (!details) return '-'
    try {
      const str = JSON.stringify(details)
      return str.length > 120 ? `${str.slice(0, 120)}…` : str
    } catch (e) {
      return '-'
    }
  }

  const fetchPermissionDefinitions = async () => {
    setPermLoading(true)
    setPermError('')
    try {
      const response = await fetch(`${API_URL}/permissions/definitions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : rôle ADMIN ou permission requise.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors du chargement des permissions disponibles.')
      }
      const data = await response.json()
      setPermDefs({
        permissions: data.permissions || [],
        groups: data.groups || [],
      })
    } catch (err) {
      console.error('Erreur GET /permissions/definitions', err)
      setPermError(err.message || 'Impossible de charger les permissions.')
    } finally {
      setPermLoading(false)
    }
  }

  const fetchUserPermissions = async (userId) => {
    if (!userId) return
    setPermLoading(true)
    setPermError('')
    try {
      const response = await fetch(
        `${API_URL}/permissions/utilisateurs/${userId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : permissions requises.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors du chargement des permissions utilisateur.')
      }
      const data = await response.json()
      setPermSelectedUserId(String(userId))
      setPermSelected(data.permissions || [])
    } catch (err) {
      console.error('Erreur GET /permissions/utilisateurs/:id', err)
      setPermError(err.message || 'Impossible de charger les permissions utilisateur.')
    } finally {
      setPermLoading(false)
    }
  }

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
          joursCommande: createForm.joursCommande.map((d) => Number(d)).filter((d) => !Number.isNaN(d)),
          delaisLivraison: createForm.delaisLivraison,
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
    setEditForm({
      id: magasin.id,
      nom: magasin.nom,
      code: magasin.code || '',
      joursCommande: Array.isArray(magasin.joursCommande)
        ? magasin.joursCommande.map((d) => String(d))
        : [],
      delaisLivraison: magasin.delaisLivraison || {},
    })
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
          joursCommande: editForm.joursCommande.map((d) => Number(d)).filter((d) => !Number.isNaN(d)),
          delaisLivraison: editForm.delaisLivraison,
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

  const togglePermissionCode = (code) => {
    setPermSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  const setAllPermissions = (enable) => {
    if (enable) {
      setPermSelected(permDefs.permissions.map((p) => p.code))
    } else {
      setPermSelected([])
    }
  }

  const applyPermissionGroup = (groupCode) => {
    const group = permDefs.groups.find((g) => g.code === groupCode)
    if (!group) return
    setPermSelected((prev) => Array.from(new Set([...(prev || []), ...(group.permissions || [])])))
  }

  const saveUserPermissions = async () => {
    if (!permSelectedUserId) {
      setPermError('Sélectionnez un utilisateur.')
      return
    }
    setPermLoading(true)
    setPermError('')
    setPermMessage('')
    try {
      const response = await fetch(
        `${API_URL}/permissions/utilisateurs/${permSelectedUserId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ permissions: permSelected }),
        },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (response.status === 403) {
        throw new Error('Accès refusé : permissions requises.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors de la mise à jour des permissions.')
      }
      setPermMessage('Permissions mises à jour.')
    } catch (err) {
      console.error('Erreur PUT /permissions/utilisateurs/:id', err)
      setPermError(err.message || 'Impossible de mettre à jour les permissions.')
    } finally {
      setPermLoading(false)
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

        <div className="grid md:grid-cols-6 border-b border-slate-200">
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
          {hasPerm('permissions:manage') && (
            <button
              className={`text-left px-4 py-3 text-sm font-semibold ${
                activeSection === 'permissions'
                  ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setActiveSection('permissions')}
            >
              Permissions
            </button>
          )}
          {hasPerm('audit:read') && (
            <button
              className={`text-left px-4 py-3 text-sm font-semibold ${
                activeSection === 'logs'
                  ? 'bg-emerald-50 text-emerald-800 border-l-4 border-emerald-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
              onClick={() => setActiveSection('logs')}
            >
            Logs
          </button>
          )}
          {isAdmin ? (
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
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Jours de commande
                      </label>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((label, idx) => (
                          <label key={label} className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={createForm.joursCommande.includes(String(idx))}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setCreateForm((prev) => {
                                  const set = new Set(prev.joursCommande)
                                  if (checked) set.add(String(idx))
                                  else set.delete(String(idx))
                                  return { ...prev, joursCommande: Array.from(set) }
                                })
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {createForm.joursCommande
                        .map((d) => Number(d))
                        .filter((d) => !Number.isNaN(d))
                        .sort((a, b) => a - b)
                        .map((d) => (
                          <div key={`delay-create-${d}`}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Délai livraison pour {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d]} (jours)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={createForm.delaisLivraison?.[d] ?? ''}
                              onChange={(e) =>
                                setCreateForm((prev) => ({
                                  ...prev,
                                  delaisLivraison: {
                                    ...(prev.delaisLivraison || {}),
                                    [d]: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Ex: 2"
                            />
                          </div>
                        ))}
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
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Jours de commande
                      </label>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((label, idx) => (
                          <label key={label} className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={editForm.joursCommande.includes(String(idx))}
                              onChange={(e) => {
                                const checked = e.target.checked
                                setEditForm((prev) => {
                                  const set = new Set(prev.joursCommande)
                                  if (checked) set.add(String(idx))
                                  else set.delete(String(idx))
                                  return { ...prev, joursCommande: Array.from(set) }
                                })
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {editForm.joursCommande
                        .map((d) => Number(d))
                        .filter((d) => !Number.isNaN(d))
                        .sort((a, b) => a - b)
                        .map((d) => (
                          <div key={`delay-edit-${d}`}>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">
                              Délai livraison pour {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d]} (jours)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={editForm.delaisLivraison?.[d] ?? ''}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  delaisLivraison: {
                                    ...(prev.delaisLivraison || {}),
                                    [d]: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Ex: 2"
                            />
                          </div>
                        ))}
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

          {activeSection === 'permissions' &&
            (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <>
                {(permError || permMessage) && (
                  <div
                    className={`px-4 py-3 rounded-lg border ${
                      permError
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    {permError || permMessage}
                  </div>
                )}

                <p className="text-sm text-slate-500 mb-2">
                  Sélectionnez un utilisateur, cochez les actions autorisées, puis enregistrez.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Utilisateur ciblé
                      </h3>
                      <button
                        onClick={() => {
                          if (permSelectedUserId) fetchUserPermissions(permSelectedUserId)
                        }}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
                      >
                        Recharger
                      </button>
                    </div>
                    <select
                      value={permSelectedUserId}
                      onChange={(e) => {
                        const val = e.target.value
                        setPermSelectedUserId(val)
                        setPermMessage('')
                        setPermError('')
                        if (val) fetchUserPermissions(val)
                        else setPermSelected([])
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="">Choisir un utilisateur...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nom} ({u.email}) — {u.role}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setAllPermissions(true)}
                        className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-xs font-semibold transition"
                      >
                        Tout cocher
                      </button>
                      <button
                        onClick={() => setAllPermissions(false)}
                        className="inline-flex items-center rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-2 text-xs font-semibold transition"
                      >
                        Tout décocher
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">
                        Appliquer un ensemble
                      </label>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) {
                            applyPermissionGroup(val)
                            e.target.value = ''
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                      >
                        <option value="">Choisir un ensemble...</option>
                        {permDefs.groups.map((g) => (
                          <option key={g.code} value={g.code}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="text-xs text-slate-500">
                      Les utilisateurs ADMIN / SUPER_ADMIN restent autorisés à tout faire par défaut.
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Permissions</h3>
                        <p className="text-xs text-slate-500">
                          Cochez les actions autorisées pour cet utilisateur.
                        </p>
                      </div>
                      <button
                        onClick={saveUserPermissions}
                        disabled={permLoading || !permSelectedUserId}
                        className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-xs font-semibold transition disabled:opacity-60"
                      >
                        {permLoading ? 'Sauvegarde...' : 'Enregistrer'}
                      </button>
                    </div>

                    {permLoading && (
                      <p className="text-sm text-slate-500">Chargement des permissions...</p>
                    )}

                    {!permLoading && !permSelectedUserId && (
                      <p className="text-sm text-slate-500">Sélectionnez un utilisateur.</p>
                    )}

                    {!permLoading && permSelectedUserId && (
                      <div className="space-y-3">
                        {Object.entries(
                          permDefs.permissions.reduce((acc, p) => {
                            const cat = p.category || 'Autres'
                            if (!acc[cat]) acc[cat] = []
                            acc[cat].push(p)
                            return acc
                          }, {}),
                        ).map(([cat, items]) => (
                          <div key={cat} className="border border-slate-100 rounded-lg p-3">
                            <p className="text-xs font-semibold text-slate-600 mb-2">{cat}</p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {items
                                .slice()
                                .sort((a, b) => a.label.localeCompare(b.label))
                                .map((item) => (
                                  <label
                                    key={item.code}
                                    className="flex items-center gap-2 text-sm text-slate-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={permSelected.includes(item.code)}
                                      onChange={() => togglePermissionCode(item.code)}
                                      className="rounded border-slate-300"
                                    />
                                    <span>{item.label}</span>
                                  </label>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

          {activeSection === 'logs' &&
            (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Action contient
                    </label>
                    <input
                      type="text"
                      value={logsFilters.action}
                      onChange={(e) =>
                        setLogsFilters((prev) => ({ ...prev, action: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="ex: produit:create"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Recherche (email/action/path)
                    </label>
                    <input
                      type="text"
                      value={logsFilters.q}
                      onChange={(e) => setLogsFilters((prev) => ({ ...prev, q: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="email, route…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Magasin ID
                    </label>
                    <input
                      type="number"
                      value={logsFilters.magasinId}
                      onChange={(e) =>
                        setLogsFilters((prev) => ({ ...prev, magasinId: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="ex: 1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Succès/erreur
                    </label>
                    <select
                      value={logsFilters.success}
                      onChange={(e) =>
                        setLogsFilters((prev) => ({ ...prev, success: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="all">Tous</option>
                      <option value="true">Succès</option>
                      <option value="false">Erreurs</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Limite
                    </label>
                    <select
                      value={logsFilters.limit}
                      onChange={(e) =>
                        setLogsFilters((prev) => ({
                          ...prev,
                          limit: Number(e.target.value) || 50,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                      {[25, 50, 100, 150, 200].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={fetchAuditLogs}
                    className="inline-flex items-center h-10 mt-6 rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 text-sm font-semibold transition"
                  >
                    {logsLoading ? 'Chargement...' : 'Recharger'}
                  </button>
                </div>

                {logsError && (
                  <div className="px-4 py-3 rounded-lg border bg-red-50 border-red-200 text-red-700">
                    {logsError}
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                        <th className="px-3 py-2 font-semibold">Date</th>
                        <th className="px-3 py-2 font-semibold">Action</th>
                        <th className="px-3 py-2 font-semibold">Utilisateur</th>
                        <th className="px-3 py-2 font-semibold">Magasin</th>
                        <th className="px-3 py-2 font-semibold">Ressource</th>
                        <th className="px-3 py-2 font-semibold">Succès</th>
                        <th className="px-3 py-2 font-semibold">Détails</th>
                        <th className="px-3 py-2 font-semibold">Req ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logsLoading ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-slate-600" colSpan={8}>
                            Chargement des logs...
                          </td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td className="px-3 py-4 text-center text-slate-600" colSpan={8}>
                            Aucun log pour ces filtres.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr
                            key={log.id}
                            className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                          >
                            <td className="px-3 py-2 text-slate-600">
                              {formatDateTime(log.createdAt)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-slate-900 font-semibold">
                                {log.humanMessage || log.actionLabel || log.action}
                              </div>
                              <div className="text-xs text-slate-500">
                                {log.action}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {log.userEmail || log.userId || '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {log.magasinId ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {log.resourceType || '-'}
                              {log.resourceId ? ` #${log.resourceId}` : ''}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  log.success
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {log.success ? 'OK' : 'Erreur'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              {detailsPreview(log.details)}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-xs">
                              {log.requestId || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
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
                      <th className="px-3 py-2 font-semibold">Prénom</th>
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
                          <td className="px-3 py-2 text-slate-900 font-medium">
                            {u.nom || '-'}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{u.prenom || '-'}</td>
                          <td className="px-3 py-2 text-slate-700">{u.email}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((x) =>
                                  x.id === u.id ? { ...x, role: e.target.value } : x,
                                ),
                              )
                            }
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm"
                          >
                            <option value="UTILISATEUR">UTILISATEUR</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          </select>
                        </td>
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
                              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 mr-3"
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
                            <button
                              className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                              onClick={async () => {
                                try {
                                  const response = await fetch(
                                    `${API_URL}/utilisateurs/${u.id}/role`,
                                    {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                      },
                                      body: JSON.stringify({ role: u.role }),
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
                                      errorText || 'Erreur lors de la mise à jour du rôle utilisateur.',
                                    )
                                  }
                                  setUserMessage('Rôle utilisateur mis à jour.')
                                  await fetchUsers()
                                } catch (err) {
                                  console.error('Erreur PUT /utilisateurs/:id/role', err)
                                  setUserError(err.message || 'Impossible de mettre à jour le rôle.')
                                }
                              }}
                            >
                              Enregistrer rôle
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
