import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

function Inventaire() {
  const { token, logout } = useAuth()
  const { selectedMagasinId } = useMagasin()
  const [produits, setProduits] = useState([])
  const [stockByProduitId, setStockByProduitId] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [inputs, setInputs] = useState({})
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [importState, setImportState] = useState({
    file: null,
    loading: false,
    error: '',
    result: null,
  })
  const [inventaires, setInventaires] = useState([])
  const [loadingInv, setLoadingInv] = useState(false)
  const [editLineState, setEditLineState] = useState({})

  const fetchProduits = async () => {
    setLoading(true)
    setError('')
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/produits${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des produits.')
      }
      const data = await response.json()
      setProduits(data.filter((p) => p.actif))
    } catch (err) {
      console.error('Erreur GET /produits', err)
      setError(err.message || 'Impossible de charger les produits.')
    } finally {
      setLoading(false)
    }
  }

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
        throw new Error(errorText || 'Erreur lors du chargement des stocks.')
      }
      const data = await response.json()
      const map = {}
      data.forEach((item) => {
        map[item.produitId] = item.stock
      })
      setStockByProduitId(map)
    } catch (err) {
      console.error('Erreur GET /stock/produits', err)
      setError(err.message || 'Impossible de charger les stocks.')
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchProduits()
      fetchStock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const fetchInventaires = async () => {
    setLoadingInv(true)
    try {
      const params = new URLSearchParams()
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const response = await fetch(`${API_URL}/stock/inventaires?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors du chargement des inventaires.')
      }
      const data = await response.json()
      setInventaires(data)
    } catch (err) {
      console.error('Erreur GET /stock/inventaires', err)
      setError(err.message || 'Impossible de charger les inventaires.')
    } finally {
      setLoadingInv(false)
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchInventaires()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const filteredProduits = useMemo(() => {
    if (!searchTerm.trim()) return produits
    const lower = searchTerm.toLowerCase()
    return produits.filter(
      (p) =>
        p.nom?.toLowerCase().includes(lower) ||
        p.reference?.toLowerCase().includes(lower),
    )
  }, [produits, searchTerm])

  const handleInputChange = (id, value) => {
    setInputs((prev) => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    setActionLoading(true)
    setError('')
    setMessage('')
    try {
      const lignes = Object.entries(inputs)
        .filter(([_, val]) => val !== '' && val !== null && val !== undefined)
        .map(([pid, val]) => ({
          produitId: Number(pid),
          quantiteReelle: Number(val),
        }))
        .filter((l) => !Number.isNaN(l.quantiteReelle))

      if (lignes.length === 0) {
        setError('Aucune quantité renseignée.')
        return
      }

      const response = await fetch(`${API_URL}/stock/inventaire`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lignes, magasinId: selectedMagasinId }),
      })

      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || 'Erreur lors de l’enregistrement de l’inventaire.',
        )
      }

      setMessage('Inventaire enregistré, stocks ajustés.')
      setInputs({})
      await fetchStock()
    } catch (err) {
      console.error('Erreur POST /stock/inventaire', err)
      setError(err.message || 'Impossible d’enregistrer l’inventaire.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
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
      {downloadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {downloadError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Inventaire
            </h2>
            <p className="text-sm text-slate-500">
              Saisissez les quantités réelles pour ajuster le stock.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setDownloadError('')
                setDownloading(true)
                try {
                  const params = new URLSearchParams()
                  if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
                  const response = await fetch(
                    `${API_URL}/stock/inventaire-feuille-excel?${params.toString()}`,
                    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                  )
                  if (response.status === 401) {
                    logout()
                    throw new Error('Session expirée, merci de vous reconnecter.')
                  }
                  if (!response.ok) {
                    const t = await response.text()
                    throw new Error(t || 'Erreur export Excel')
                  }
                  const blob = await response.blob()
                  const url = window.URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'Inventaire.xlsx'
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  window.URL.revokeObjectURL(url)
                } catch (err) {
                  console.error('Erreur export Excel inventaire', err)
                  setDownloadError(err.message || 'Impossible de télécharger le fichier Excel.')
                } finally {
                  setDownloading(false)
                }
              }}
              className="inline-flex items-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold transition"
            >
              Export Excel
            </button>
            <button
              onClick={async () => {
                setDownloadError('')
                setDownloading(true)
                try {
                  const params = new URLSearchParams()
                  if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
                  const response = await fetch(
                    `${API_URL}/stock/inventaire-feuille-pdf?${params.toString()}`,
                    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                  )
                  if (response.status === 401) {
                    logout()
                    throw new Error('Session expirée, merci de vous reconnecter.')
                  }
                  if (!response.ok) {
                    const t = await response.text()
                    throw new Error(t || 'Erreur export PDF')
                  }
                  const blob = await response.blob()
                  const url = window.URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'Inventaire.pdf'
                  document.body.appendChild(link)
                  link.click()
                  link.remove()
                  window.URL.revokeObjectURL(url)
                } catch (err) {
                  console.error('Erreur export PDF inventaire', err)
                  setDownloadError(err.message || 'Impossible de télécharger le PDF.')
                } finally {
                  setDownloading(false)
                }
              }}
              className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition"
            >
              Export PDF
            </button>
            <button
              onClick={() => {
                fetchProduits()
                fetchStock()
              }}
              className="inline-flex items-center rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 text-sm font-semibold transition"
            >
              Recharger
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
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
          <div className="flex items-end gap-2">
            <button
              onClick={handleSave}
              disabled={actionLoading}
              className="inline-flex items-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {actionLoading ? 'Enregistrement...' : 'Enregistrer l’inventaire'}
            </button>
            <div className="flex flex-col text-sm text-slate-600">
              <label className="text-sm font-medium text-slate-700 mb-1">
                Import Excel inventaire
              </label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) =>
                  setImportState((prev) => ({
                    ...prev,
                    file: e.target.files?.[0] || null,
                  }))
                }
                className="text-xs"
              />
              <button
                onClick={async () => {
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
                    const response = await fetch(
                      `${API_URL}/stock/inventaire-import?${params.toString()}`,
                      {
                        method: 'POST',
                        body: formData,
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      },
                    )
                    if (response.status === 401) {
                      logout()
                      throw new Error('Session expirée, merci de vous reconnecter.')
                    }
                    if (!response.ok) {
                      const t = await response.text()
                      throw new Error(t || 'Erreur lors de l’import inventaire.')
                    }
                    const data = await response.json()
                    setImportState((prev) => ({ ...prev, result: data }))
                    setMessage('Import inventaire réussi.')
                    await fetchStock()
                  } catch (err) {
                    console.error('Erreur import inventaire', err)
                    setImportState((prev) => ({
                      ...prev,
                      error: err.message || 'Impossible d’importer le fichier.',
                    }))
                  } finally {
                    setImportState((prev) => ({ ...prev, loading: false }))
                  }
                }}
                className="mt-2 inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60"
                disabled={importState.loading}
              >
                {importState.loading ? 'Import...' : 'Importer'}
              </button>
              {importState.error && (
                <p className="text-xs text-red-600 mt-1">{importState.error}</p>
              )}
              {importState.result && importState.result.produits_non_trouves?.length > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  Non trouvés : {importState.result.produits_non_trouves.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <th className="px-3 py-2 font-semibold">Produit</th>
                <th className="px-3 py-2 font-semibold">Référence</th>
                <th className="px-3 py-2 font-semibold">Stock théorique</th>
                <th className="px-3 py-2 font-semibold">Quantité réelle</th>
                <th className="px-3 py-2 font-semibold">Écart</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-center" colSpan={5}>
                    Chargement des produits...
                  </td>
                </tr>
              ) : filteredProduits.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                filteredProduits.map((p) => {
                  const stock = stockByProduitId[p.id] ?? 0
                  const saisi =
                    inputs[p.id] === undefined || inputs[p.id] === null
                      ? ''
                      : inputs[p.id]
                  const ecart =
                    saisi === '' || Number.isNaN(Number(saisi))
                      ? 0
                      : Number(saisi) - stock
                  const ecartClass =
                    ecart === 0
                      ? 'text-slate-700'
                      : ecart > 0
                        ? 'text-emerald-700 font-semibold'
                        : 'text-orange-700 font-semibold'

                  return (
                    <tr
                      key={p.id}
                      className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-3 py-2 text-slate-900 font-medium">
                        {p.nom}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {p.reference || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-900">{stock}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          value={saisi}
                          onChange={(e) => handleInputChange(p.id, e.target.value)}
                        />
                      </td>
                      <td className={`px-3 py-2 ${ecartClass}`}>{ecart}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Historique des inventaires</h2>
            <p className="text-sm text-slate-500">50 derniers, avec possibilité d’annuler.</p>
          </div>
          <button
            onClick={fetchInventaires}
            className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition"
          >
            Recharger
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Statut</th>
                <th className="px-3 py-2 font-semibold">Utilisateur</th>
                <th className="px-3 py-2 font-semibold">Lignes</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingInv ? (
                <tr>
                  <td className="px-3 py-4 text-center" colSpan={4}>
                    Chargement...
                  </td>
                </tr>
              ) : inventaires.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={4}>
                    Aucun inventaire enregistré.
                  </td>
                </tr>
              ) : (
                inventaires.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-slate-900">
                      {new Date(inv.date).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          inv.statut === 'VALIDE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {inv.statut === 'VALIDE' ? 'Valide' : 'Annulé'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 text-sm">
                      {inv.utilisateur?.nom || inv.utilisateur?.email || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {inv._count?.lignes ?? inv.lignes?.length ?? 0}
                    </td>
                    <td className="px-3 py-2">
                      {inv.statut === 'VALIDE' ? (
                        <div className="space-y-2">
                          <button
                            onClick={async () => {
                              try {
                                const params = new URLSearchParams()
                                if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
                                const response = await fetch(
                                  `${API_URL}/stock/inventaire/${inv.id}/pdf?${params.toString()}`,
                                  { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                                )
                                if (response.status === 401) {
                                  logout()
                                  throw new Error('Session expirée, merci de vous reconnecter.')
                                }
                                if (!response.ok) {
                                  const t = await response.text()
                                  throw new Error(t || 'Erreur PDF inventaire.')
                                }
                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                const link = document.createElement('a')
                                link.href = url
                                link.download = `Inventaire_${inv.id}.pdf`
                                document.body.appendChild(link)
                                link.click()
                                link.remove()
                                window.URL.revokeObjectURL(url)
                              } catch (err) {
                                console.error('Erreur PDF inventaire', err)
                                setError(err.message || 'Impossible de télécharger le PDF inventaire.')
                              }
                            }}
                            className="text-sm text-emerald-700 hover:text-emerald-900 font-semibold"
                          >
                            PDF
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const params = new URLSearchParams()
                                if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
                                const response = await fetch(
                                  `${API_URL}/stock/inventaire/${inv.id}/annuler?${params.toString()}`,
                                  { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} },
                                )
                                if (response.status === 401) {
                                  logout()
                                  throw new Error('Session expirée, merci de vous reconnecter.')
                                }
                                if (!response.ok) {
                                  const t = await response.text()
                                  throw new Error(t || 'Erreur lors de l’annulation.')
                                }
                                setMessage('Inventaire annulé, stocks restaurés.')
                                await fetchStock()
                                await fetchInventaires()
                              } catch (err) {
                                console.error('Erreur annulation inventaire', err)
                                setError(err.message || 'Impossible d’annuler l’inventaire.')
                              }
                            }}
                            className="text-sm text-red-600 hover:text-red-800 font-semibold"
                          >
                            Annuler
                          </button>
                          {inv.lignes?.length > 0 && (
                            <div className="space-y-1 border border-slate-200 rounded-lg p-2">
                              <p className="text-xs font-semibold text-slate-700">
                                Corriger une ligne
                              </p>
                              <select
                                value={editLineState[inv.id]?.ligneId || ''}
                                onChange={(e) =>
                                  setEditLineState((prev) => ({
                                    ...prev,
                                    [inv.id]: {
                                      ...(prev[inv.id] || {}),
                                      ligneId: Number(e.target.value),
                                    },
                                  }))
                                }
                                className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                              >
                                <option value="">Sélectionner une ligne</option>
                                {inv.lignes.map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.produit?.nom} ({l.produit?.reference || '-'}) — {l.quantiteReelle} u.
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                placeholder="Nouvelle quantité réelle"
                                value={editLineState[inv.id]?.quantite || ''}
                                onChange={(e) =>
                                  setEditLineState((prev) => ({
                                    ...prev,
                                    [inv.id]: {
                                      ...(prev[inv.id] || {}),
                                      quantite: e.target.value,
                                    },
                                  }))
                                }
                              />
                              <button
                                className="w-full inline-flex items-center justify-center rounded bg-slate-800 text-white text-xs font-semibold py-1 hover:bg-slate-900"
                                onClick={async () => {
                                  const state = editLineState[inv.id] || {}
                                  if (!state.ligneId || state.quantite === undefined) {
                                    setError('Choisissez une ligne et une quantité.')
                                    return
                                  }
                                  const ligne = inv.lignes.find((l) => l.id === Number(state.ligneId))
                                  if (!ligne) {
                                    setError('Ligne introuvable.')
                                    return
                                  }
                                  try {
                                    const params = new URLSearchParams()
                                    if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
                                    const response = await fetch(
                                      `${API_URL}/stock/inventaire/${inv.id}/modifier-ligne?${params.toString()}`,
                                      {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                        },
                                        body: JSON.stringify({
                                          produitId: ligne.produitId,
                                          quantiteReelle: Number(state.quantite),
                                        }),
                                      },
                                    )
                                    if (response.status === 401) {
                                      logout()
                                      throw new Error('Session expirée, merci de vous reconnecter.')
                                    }
                                    if (!response.ok) {
                                      const t = await response.text()
                                      throw new Error(t || 'Erreur lors de la modification.')
                                    }
                                    setMessage('Ligne inventaire mise à jour.')
                                    await fetchStock()
                                    await fetchInventaires()
                                  } catch (err) {
                                    console.error('Erreur modif ligne inventaire', err)
                                    setError(err.message || 'Impossible de modifier la ligne.')
                                  }
                                }}
                              >
                                Mettre à jour
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Inventaire
