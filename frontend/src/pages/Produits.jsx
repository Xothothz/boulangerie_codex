import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

const priceFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function Produits() {
  const { token, logout, user } = useAuth()
  const { selectedMagasinId, magasins } = useMagasin()
  const [produits, setProduits] = useState([])
  const [stockByProduitId, setStockByProduitId] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [categories, setCategories] = useState([])
  const [filterCategorieId, setFilterCategorieId] = useState('')
  const [filterActif, setFilterActif] = useState('all') // all | true | false
  const [sortKey, setSortKey] = useState('nom')
  const [sortDir, setSortDir] = useState('asc')
  const initialForm = {
    nom: '',
    reference: '',
    categorie: '',
    prixVente: '',
    ean13: '',
    ifls: '',
    quantiteJour: '',
    prixAchat: '',
    unitesCarton: '',
    categorieId: '',
  }
  const [formData, setFormData] = useState(initialForm)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [actionMessage, setActionMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [toggleLoadingId, setToggleLoadingId] = useState(null)
  const [activeTab, setActiveTab] = useState('list') // list | add
  const [importState, setImportState] = useState({
    file: null,
    loading: false,
    error: '',
    result: null,
  })
  const [allowCustomReference, setAllowCustomReference] = useState(false)

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  const magasinCode = useMemo(() => {
    const mag = magasins.find((m) => m.id === selectedMagasinId)
    return mag?.code || ''
  }, [magasins, selectedMagasinId])

  const slugifyReferenceBase = (value) =>
    (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'PRODUIT'

  const autoReferencePreview = useMemo(() => {
    const prefix = magasinCode ? `${magasinCode}-` : ''
    return `${prefix}${slugifyReferenceBase(formData.nom)}`
  }, [formData.nom, magasinCode])

  const referenceDisplayValue =
    formData.reference || autoReferencePreview

  const fetchProduits = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      if (filterActif !== 'all') params.set('actif', filterActif === 'true' ? 'true' : 'false')
      const qs = params.toString() ? `?${params.toString()}` : ''

      const response = await fetch(`${API_URL}/produits${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || 'Erreur lors du chargement des produits.',
        )
      }
      const data = await response.json()
      setProduits(data)
    } catch (err) {
      console.error('Erreur GET /produits', err)
      setError(err.message || 'Impossible de récupérer les produits.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchProduits()
    }
  }, [selectedMagasinId, filterActif])

  const fetchCategories = async () => {
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
        throw new Error(
          errorText || 'Erreur lors du chargement des catégories.',
        )
      }
      const data = await response.json()
      setCategories(data)
    } catch (err) {
      console.error('Erreur GET /categories', err)
      setActionError(err.message || 'Impossible de récupérer les catégories.')
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const fetchStock = async () => {
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/stock/produits${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || 'Erreur lors du chargement des stocks.',
        )
      }
      const data = await response.json()
      const map = {}
      data.forEach((item) => {
        map[item.produitId] = item.stock
      })
      setStockByProduitId(map)
    } catch (err) {
      console.error('Erreur GET /stock/produits', err)
      setActionError(err.message || 'Impossible de récupérer les stocks.')
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchStock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const filteredProduits = useMemo(() => {
    let list = produits
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      list = list.filter(
        (p) =>
          p.nom?.toLowerCase().includes(lower) ||
          p.reference?.toLowerCase().includes(lower),
      )
    }
    if (filterCategorieId) {
      list = list.filter(
        (p) =>
          String(p.categorieId || '') === String(filterCategorieId) ||
          String(p.categorieRef?.id || '') === String(filterCategorieId),
      )
    }

    const compare = (a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'nom') {
        return a.nom.localeCompare(b.nom) * dir
      }
      if (sortKey === 'prixVente') {
        return ((a.prixVente || 0) - (b.prixVente || 0)) * dir
      }
      if (sortKey === 'stock') {
        const sa = stockByProduitId[a.id] ?? 0
        const sb = stockByProduitId[b.id] ?? 0
        return (sa - sb) * dir
      }
      return 0
    }

    return [...list].sort(compare)
  }, [filterCategorieId, produits, searchTerm, sortDir, sortKey, stockByProduitId])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    if (name === 'reference' && !allowCustomReference) return
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setActionError('')
    setActionMessage('')
    if (!formData.nom.trim()) {
      setActionError('Le nom du produit est obligatoire.')
      return
    }
    if (
      formData.prixVente === '' ||
      Number.isNaN(Number(formData.prixVente))
    ) {
      setActionError('Le prix de vente est obligatoire.')
      return
    }

    setAdding(true)
    try {
      const quantiteJourParsed =
        formData.quantiteJour === '' ? null : parseInt(formData.quantiteJour, 10)

      const referencePayload = allowCustomReference
        ? formData.reference.trim() || null
        : editingId
          ? undefined
          : null

      const payloadBase = {
        nom: formData.nom.trim(),
        reference: referencePayload,
        categorie: formData.categorie.trim() || null,
        ean13: formData.ean13.trim() || null,
        ifls: formData.ifls.trim() || null,
        quantiteJour:
          Number.isNaN(quantiteJourParsed) || quantiteJourParsed === null
            ? null
            : quantiteJourParsed,
        prixVente: Number(formData.prixVente),
        magasinId: selectedMagasinId || undefined,
        prixAchat:
          formData.prixAchat === '' || Number.isNaN(Number(formData.prixAchat))
            ? null
            : Number(formData.prixAchat),
        unitesCarton:
          formData.unitesCarton === '' || Number.isNaN(Number(formData.unitesCarton))
            ? null
            : parseInt(formData.unitesCarton, 10),
        categorieId: formData.categorieId ? Number(formData.categorieId) : null,
      }

      const endpoint = editingId
        ? `${API_URL}/produits/${editingId}${selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''}`
        : `${API_URL}/produits`
      const method = editingId ? 'PUT' : 'POST'

      const payload = {
        ...payloadBase,
        categorie:
          payloadBase.categorie ||
          categories.find((c) => String(c.id) === String(payloadBase.categorieId))
            ?.nom ||
          null,
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || 'Échec de l’ajout du produit. Veuillez réessayer.',
        )
      }

      setFormData(initialForm)
      setEditingId(null)
      setAllowCustomReference(false)
      setActionMessage(
        editingId ? 'Produit mis à jour avec succès.' : 'Produit ajouté avec succès.',
      )
      await fetchProduits()
      await fetchStock()
    } catch (err) {
      console.error('Erreur POST /produits', err)
      setActionError(
        err.message ||
          (editingId
            ? 'Erreur lors de la mise à jour du produit.'
            : 'Erreur lors de l’ajout du produit.'),
      )
    } finally {
      setAdding(false)
    }
  }

  const downloadExcel = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const qs = params.toString() ? `?${params.toString()}` : ''

      const response = await fetch(`${API_URL}/produits/export-excel${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur export Excel produits.')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'Produits.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur export Excel produits', err)
      setActionError(err.message || 'Impossible de télécharger le fichier.')
    }
  }

  const importExcel = async () => {
    if (!importState.file) {
      setImportState((prev) => ({ ...prev, error: 'Choisissez un fichier .xlsx' }))
      return
    }
    setImportState((prev) => ({ ...prev, loading: true, error: '', result: null }))
    try {
      const formData = new FormData()
      formData.append('file', importState.file)
      const params = new URLSearchParams()
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const qs = params.toString() ? `?${params.toString()}` : ''

      const response = await fetch(`${API_URL}/produits/import-excel${qs}`, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors de l’import.')
      }
      const data = await response.json()
      setImportState((prev) => ({ ...prev, result: data }))
      setActionMessage('Import produits terminé.')
      await fetchProduits()
      await fetchStock()
    } catch (err) {
      console.error('Erreur import Excel produits', err)
      setImportState((prev) => ({
        ...prev,
        error: err.message || 'Impossible d’importer le fichier.',
      }))
    } finally {
      setImportState((prev) => ({ ...prev, loading: false }))
    }
  }

  const toggleActif = async (produit) => {
    setToggleLoadingId(produit.id)
    setActionError('')
    setActionMessage('')
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/produits/${produit.id}${query}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ actif: !produit.actif }),
      })

      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText ||
            'Impossible de mettre à jour le statut du produit. Veuillez réessayer.',
        )
      }

      await fetchProduits()
      await fetchStock()
    } catch (err) {
      console.error('Erreur PUT /produits/:id', err)
      setActionError(err.message || 'Erreur lors de la mise à jour du statut.')
    } finally {
      setToggleLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || actionError}
        </div>
      )}
      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
          {actionMessage}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            activeTab === 'list'
              ? 'bg-emerald-700 text-white'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          Liste des produits
        </button>
        <button
          onClick={() => {
            setActiveTab('add')
            if (!editingId) setFormData(initialForm)
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            activeTab === 'add'
              ? 'bg-emerald-700 text-white'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          Ajouter / modifier
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Liste des produits
              </h2>
              <p className="text-slate-500 text-sm">
                Produits du magasin, actifs et désactivés
              </p>
            </div>
            <button
              onClick={async () => {
                await fetchProduits()
                await fetchStock()
              }}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition"
            >
              Recharger
            </button>
          </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[240px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Rechercher par nom ou référence
              </label>
              <input
                type="text"
                placeholder="Ex : baguette"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="min-w-[180px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Filtrer par catégorie
              </label>
              <select
                value={filterCategorieId}
                onChange={(e) => setFilterCategorieId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
              >
                <option value="">Toutes</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Statut
              </label>
              <select
                value={filterActif}
                onChange={(e) => setFilterActif(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
              >
                <option value="all">Actifs et inactifs</option>
                <option value="true">Actifs uniquement</option>
                <option value="false">Inactifs uniquement</option>
              </select>
            </div>
            <div className="flex items-end gap-2 min-w-[220px]">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Trier par
                </label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                >
                  <option value="nom">Nom</option>
                  <option value="prixVente">Prix de vente</option>
                  <option value="stock">Stock</option>
                </select>
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Ordre
                </label>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>
          </div>
        </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <th className="px-3 py-2 font-semibold">ID</th>
                  <th className="px-3 py-2 font-semibold">Nom</th>
                  <th className="px-3 py-2 font-semibold">Référence</th>
                  <th className="px-3 py-2 font-semibold">Catégorie</th>
                  <th className="px-3 py-2 font-semibold">EAN</th>
                  <th className="px-3 py-2 font-semibold">IFLS</th>
                  <th className="px-3 py-2 font-semibold">Qté/jour</th>
                  <th className="px-3 py-2 font-semibold">Prix achat</th>
                  <th className="px-3 py-2 font-semibold">Unités/carton</th>
                  <th className="px-3 py-2 font-semibold">Stock</th>
                  <th className="px-3 py-2 font-semibold">Prix de vente</th>
                  <th className="px-3 py-2 font-semibold">Actif</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-center" colSpan={13}>
                      Chargement des produits...
                    </td>
                  </tr>
                ) : filteredProduits.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500" colSpan={13}>
                      Aucun produit trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredProduits.map((produit) => (
                    <tr
                      key={produit.id}
                      className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 text-slate-700">{produit.id}</td>
                      <td className="px-3 py-2 text-slate-900 font-medium">
                        {produit.nom}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {produit.reference || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {produit.categorieRef?.nom || produit.categorie || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {produit.ean13 || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {produit.ifls || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {produit.quantiteJour ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {produit.prixAchat !== undefined && produit.prixAchat !== null
                          ? `${priceFormatter.format(Number(produit.prixAchat))} €`
                          : '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {produit.unitesCarton ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {stockByProduitId[produit.id] ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-900">
                        {produit.prixVente !== undefined && produit.prixVente !== null
                          ? `${priceFormatter.format(produit.prixVente)} €`
                          : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            produit.actif
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {produit.actif ? 'Oui' : 'Non'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => {
                              setEditingId(produit.id)
                              setFormData({
                                nom: produit.nom || '',
                                reference: produit.reference || '',
                                categorie: produit.categorie || '',
                                prixVente: produit.prixVente || '',
                                ean13: produit.ean13 || '',
                                ifls: produit.ifls || '',
                                quantiteJour: produit.quantiteJour ?? '',
                                prixAchat: produit.prixAchat ?? '',
                                unitesCarton: produit.unitesCarton ?? '',
                                categorieId: produit.categorieRef?.id || '',
                              })
                              setAllowCustomReference(false)
                              setActiveTab('add')
                            }}
                            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => toggleActif(produit)}
                            disabled={toggleLoadingId === produit.id}
                            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
                          >
                            {toggleLoadingId === produit.id
                              ? 'Mise à jour...'
                              : produit.actif
                                ? 'Désactiver'
                                : 'Activer'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'add' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {editingId ? 'Modifier un produit' : 'Ajouter un produit'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setFormData(initialForm)
                setAllowCustomReference(false)
              }}
              className="text-sm text-slate-600 hover:text-slate-800"
            >
              Annuler
            </button>
          )}
        </div>
        <p className="text-slate-500 text-sm mb-4">
          Renseignez les informations du produit à {editingId ? 'mettre à jour' : 'créer'}.
        </p>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadExcel}
              className="inline-flex items-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-sm font-semibold transition"
            >
              Télécharger Excel produits
            </button>
            <div className="text-xs text-slate-500">
              Exportez la liste actuelle, modifiez-la, puis réimportez-la ci-dessous.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) =>
                setImportState((prev) => ({ ...prev, file: e.target.files?.[0] || null, error: '', result: null }))
              }
              className="text-xs"
            />
            <button
              type="button"
              onClick={importExcel}
              disabled={importState.loading}
              className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {importState.loading ? 'Import...' : 'Importer Excel'}
            </button>
          </div>
        </div>
        {importState.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">
            {importState.error}
          </div>
        )}
        {importState.result && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm mb-3">
            Import terminé : {importState.result.updated || 0} mis à jour, {importState.result.created || 0} créés.
            {importState.result.errors?.length > 0 && (
              <div className="text-xs text-amber-700 mt-1">
                {importState.result.errors.slice(0, 3).join(' | ')}
                {importState.result.errors.length > 3 ? ' ...' : ''}
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              name="nom"
              value={formData.nom}
              onChange={handleInputChange}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Référence
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                name="reference"
                value={referenceDisplayValue}
                onChange={handleInputChange}
                readOnly={!allowCustomReference}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:cursor-not-allowed"
              />
              {isAdmin && (
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={allowCustomReference}
                    onChange={(e) => setAllowCustomReference(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Forcer la référence (admin)
                </label>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {allowCustomReference
                ? 'Référence saisie manuellement (préfixée si code magasin).'
                : `Référence générée automatiquement : ${autoReferencePreview}${
                    formData.reference ? ` (actuelle : ${formData.reference})` : ''
                  }`}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Catégorie
            </label>
            <select
              name="categorieId"
              value={formData.categorieId}
              onChange={(e) => {
                const selected = e.target.value
                setFormData((prev) => ({
                  ...prev,
                  categorieId: selected,
                  categorie:
                    categories.find((c) => String(c.id) === String(selected))?.nom ||
                    '',
                }))
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
            >
              <option value="">Aucune</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              EAN (13 chiffres)
            </label>
            <input
              type="text"
              name="ean13"
              value={formData.ean13}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Code IFLS (6 chiffres)
            </label>
            <input
              type="text"
              name="ifls"
              value={formData.ifls}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Quantité mise en vente par jour
            </label>
            <input
              type="number"
              name="quantiteJour"
              value={formData.quantiteJour}
              onChange={handleInputChange}
              min="0"
              step="1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prix d&apos;achat (€)
            </label>
            <input
              type="number"
              name="prixAchat"
              value={formData.prixAchat}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Unités par carton
            </label>
            <input
              type="number"
              name="unitesCarton"
              value={formData.unitesCarton}
              onChange={handleInputChange}
              min="0"
              step="1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prix de vente (€)
            </label>
            <input
              type="number"
              name="prixVente"
              value={formData.prixVente}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 font-semibold text-sm transition disabled:opacity-60"
            >
              {adding
                ? editingId
                  ? 'Mise à jour...'
                  : 'Ajout en cours...'
                : editingId
                  ? 'Mettre à jour'
                : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
      )}
    </div>
  )
}

export default Produits
