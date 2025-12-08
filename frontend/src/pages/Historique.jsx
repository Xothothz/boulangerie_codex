import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

const typeOptions = [
  { value: 'all', label: 'Tous' },
  { value: 'VENTE', label: 'Mises en vente' },
  { value: 'PERTE', label: 'Pertes' },
  { value: 'INVENTAIRE', label: 'Inventaire' },
  { value: 'RECEPTION', label: 'Entrées' },
]

const natureLabel = (nature) => {
  switch (nature) {
    case 'VENTE':
      return 'Mise en vente'
    case 'PERTE':
      return 'Perte'
    case 'INVENTAIRE':
      return 'Inventaire'
    case 'RECEPTION':
      return 'Entrée'
    default:
      return 'Autre'
  }
}

function Historique() {
  const { token, logout } = useAuth()
  const { selectedMagasinId } = useMagasin()
  const [produits, setProduits] = useState([])
  const [mouvements, setMouvements] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedProduitId, setSelectedProduitId] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [tab, setTab] = useState('mouvements')
  const [commandes, setCommandes] = useState([])
  const [loadingCmd, setLoadingCmd] = useState(false)
  const [commandeSearch, setCommandeSearch] = useState('')
  const [commandeStatut, setCommandeStatut] = useState('all')
  const [commandeSort, setCommandeSort] = useState('date-desc')

  const fetchProduits = async () => {
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/produits${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      const data = await response.json()
      setProduits(data)
    } catch (err) {
      console.error('Erreur GET /produits', err)
      setError(err.message || 'Impossible de charger les produits.')
    }
  }

  const fetchMouvements = async () => {
    if (!selectedProduitId) return
    setLoading(true)
    setError('')
    try {
      const queryMag = selectedMagasinId ? `&magasinId=${selectedMagasinId}` : ''
      const response = await fetch(
        `${API_URL}/stock/mouvements?produitId=${selectedProduitId}${queryMag}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des mouvements.')
      }
      const data = await response.json()
      setMouvements(data)
    } catch (err) {
      console.error('Erreur GET /stock/mouvements', err)
      setError(err.message || 'Impossible de charger les mouvements.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchProduits()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchMouvements()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduitId])

  const fetchCommandes = async () => {
    setLoadingCmd(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const response = await fetch(
        `${API_URL}/commandes/historique?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des commandes.')
      }
      const data = await response.json()
      setCommandes(data)
    } catch (err) {
      console.error('Erreur GET /commandes/historique', err)
      setError(err.message || 'Impossible de charger les commandes.')
    } finally {
      setLoadingCmd(false)
    }
  }

  useEffect(() => {
    if (tab === 'commandes' && selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchCommandes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMagasinId])

  const filteredCommandes = useMemo(() => {
    let list = commandes
    if (commandeStatut !== 'all') {
      list = list.filter((c) => c.statut === commandeStatut)
    }
    if (commandeSearch.trim()) {
      const q = commandeSearch.trim().toLowerCase()
      list = list.filter(
        (c) =>
          String(c.id).includes(q) ||
          c.lignes?.some((l) => l.produit?.nom?.toLowerCase().includes(q)),
      )
    }
    const sorted = [...list].sort((a, b) => {
      if (commandeSort === 'date-asc') {
        return new Date(a.dateCommande) - new Date(b.dateCommande)
      }
      if (commandeSort === 'date-desc') {
        return new Date(b.dateCommande) - new Date(a.dateCommande)
      }
      if (commandeSort === 'id-asc') return a.id - b.id
      if (commandeSort === 'id-desc') return b.id - a.id
      return 0
    })
    return sorted
  }, [commandeSearch, commandeSort, commandeStatut, commandes])

  const filteredMouvements = useMemo(() => {
    return mouvements.filter((m) => {
      if (filterType === 'all') return true
      return m.nature === filterType
    })
  }, [filterType, mouvements])

  const formatDate = (d) =>
    new Date(d).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setTab('mouvements')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === 'mouvements'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Mises en vente / pertes
          </button>
          <button
            onClick={() => setTab('commandes')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === 'commandes'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            Commandes
          </button>
        </div>

        {tab === 'mouvements' ? (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Historique mises en vente/pertes
                </h2>
                <p className="text-sm text-slate-500">
                  Sélectionnez un produit (actif ou non) pour afficher ses mouvements de sortie.
                </p>
              </div>
              <button
                onClick={fetchMouvements}
                disabled={!selectedProduitId}
                className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
              >
                Recharger
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3 mt-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produit
                </label>
                <select
                  value={selectedProduitId}
                  onChange={(e) => setSelectedProduitId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">Choisir un produit...</option>
                  {produits
                    .slice()
                    .sort((a, b) => a.nom.localeCompare(b.nom))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nom} {p.reference ? `(${p.reference})` : ''}{' '}
                        {!p.actif ? '[Inactif]' : ''}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Filtrer
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {typeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold">Date</th>
                    <th className="px-3 py-2 font-semibold">Nature</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Quantité</th>
                    <th className="px-3 py-2 font-semibold">Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-4 text-center" colSpan={4}>
                        Chargement de l&apos;historique...
                      </td>
                    </tr>
                  ) : !selectedProduitId ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-500" colSpan={4}>
                        Sélectionnez un produit pour afficher l&apos;historique.
                      </td>
                    </tr>
                  ) : filteredMouvements.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-500" colSpan={4}>
                        Aucun mouvement trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredMouvements.map((mv) => (
                      <tr
                        key={mv.id}
                        className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2 text-slate-700">
                          {formatDate(mv.date)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              mv.nature === 'VENTE'
                                ? 'bg-emerald-100 text-emerald-700'
                                : mv.nature === 'PERTE'
                                  ? 'bg-amber-100 text-amber-700'
                                  : mv.nature === 'INVENTAIRE'
                                    ? 'bg-slate-200 text-slate-800'
                                    : mv.nature === 'RECEPTION'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {natureLabel(mv.nature)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{mv.type}</td>
                        <td
                          className={`px-3 py-2 font-semibold ${
                            mv.quantite < 0 ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          {mv.quantite}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {mv.commentaire || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Historique commandes</h2>
                <p className="text-sm text-slate-500">
                  Commandes (50 dernières), avec reçus vs commandé et PDF récapitulatif de réception.
                </p>
              </div>
              <button
                onClick={fetchCommandes}
                className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition"
              >
                Recharger
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-3 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Rechercher (n° ou produit)
                </label>
                <input
                  type="text"
                  value={commandeSearch}
                  onChange={(e) => setCommandeSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Ex : 42 ou croissant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Statut
                </label>
                <select
                  value={commandeStatut}
                  onChange={(e) => setCommandeStatut(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="all">Tous</option>
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="RECEPTION_PARTIELLE">Réception partielle</option>
                  <option value="RECEPTIONNEE">Réceptionnée</option>
                  <option value="ANNULEE">Annulée</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Trier
                </label>
                <select
                  value={commandeSort}
                  onChange={(e) => setCommandeSort(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="date-desc">Date commande (récent→ancien)</option>
                  <option value="date-asc">Date commande (ancien→récent)</option>
                  <option value="id-desc">N° commande (grand→petit)</option>
                  <option value="id-asc">N° commande (petit→grand)</option>
                </select>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="px-3 py-2 font-semibold">Commande</th>
                    <th className="px-3 py-2 font-semibold">Livraison prévue</th>
                    <th className="px-3 py-2 font-semibold">Statut</th>
                    <th className="px-3 py-2 font-semibold">Lignes</th>
                    <th className="px-3 py-2 font-semibold">PDF réception</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCmd ? (
                    <tr>
                      <td className="px-3 py-4 text-center" colSpan={5}>
                        Chargement des commandes...
                      </td>
                    </tr>
                  ) : filteredCommandes.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                        Aucune commande.
                      </td>
                    </tr>
                  ) : (
                    filteredCommandes.map((c) => (
                      <tr
                        key={c.id}
                        className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2 text-slate-900 font-semibold">
                          #{c.id} du {formatDate(c.dateCommande)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatDate(c.dateLivraisonPrevue)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{c.statut}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {(c.lignes || []).slice(0, 3).map((l) => (
                            <div key={l.id} className="text-xs text-slate-600">
                              {l.produit?.nom} — {l.unitesRecues}/{l.unites} u.
                            </div>
                          ))}
                          {(c.lignes || []).length > 3 && (
                            <div className="text-xs text-slate-500">
                              + {(c.lignes || []).length - 3} autres
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={async () => {
                              try {
                                const params = new URLSearchParams()
                                if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
                                const response = await fetch(
                                  `${API_URL}/commandes/${c.id}/reception-pdf?${params.toString()}`,
                                  { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                                )
                                if (response.status === 401) {
                                  logout()
                                  throw new Error('Session expirée, merci de vous reconnecter.')
                                }
                                if (!response.ok) {
                                  const t = await response.text()
                                  throw new Error(t || 'Erreur PDF')
                                }
                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                const link = document.createElement('a')
                                link.href = url
                                link.download = `Reception_Commande_${c.id}.pdf`
                                document.body.appendChild(link)
                                link.click()
                                link.remove()
                                window.URL.revokeObjectURL(url)
                              } catch (err) {
                                console.error('Erreur PDF réception', err)
                                setError(err.message || 'Impossible de télécharger le PDF réception.')
                              }
                            }}
                            className="text-sm text-emerald-700 hover:text-emerald-900 font-semibold"
                          >
                            Télécharger
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
  )
}

export default Historique
