import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function Valorisation() {
  const { token, logout } = useAuth()
  const { selectedMagasinId } = useMagasin()

  const [items, setItems] = useState([])
  const [totals, setTotals] = useState({ ht: 0, ttc: 0 })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategorieId, setFilterCategorieId] = useState('')
  const [sortKey, setSortKey] = useState('nom')
  const [sortDir, setSortDir] = useState('asc')

  const fetchValorisation = async () => {
    setLoading(true)
    setError('')
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/stock/valorisation${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          errorText || 'Erreur lors du chargement de la valorisation.',
        )
      }
      const data = await response.json()
      setItems(data.items || [])
      setTotals(data.totals || { ht: 0, ttc: 0 })
    } catch (err) {
      console.error('Erreur GET /stock/valorisation', err)
      setError(err.message || 'Impossible de charger la valorisation.')
    } finally {
      setLoading(false)
    }
  }

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
      setError(err.message || 'Impossible de charger les catégories.')
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchValorisation()
      fetchCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const handleDownloadPdf = async () => {
    setDownloadError('')
    setDownloadLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const response = await fetch(
        `${API_URL}/stock/valorisation/pdf?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur export PDF valorisation.')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'Valorisation_stock.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur PDF valorisation', err)
      setDownloadError(err.message || 'Impossible de télécharger le PDF.')
    } finally {
      setDownloadLoading(false)
    }
  }

  const filteredItems = useMemo(() => {
    let list = items
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase()
      list = list.filter(
        (item) =>
          item.nom?.toLowerCase().includes(lower) ||
          item.reference?.toLowerCase().includes(lower),
      )
    }
    if (filterCategorieId) {
      list = list.filter(
        (item) => String(item.categorieId || '') === String(filterCategorieId),
      )
    }

    const sorted = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'stock') {
        return ((a.stock || 0) - (b.stock || 0)) * dir
      }
      if (sortKey === 'valeurHT') {
        return ((a.valeurHT || 0) - (b.valeurHT || 0)) * dir
      }
      return (a.nom || '').localeCompare(b.nom || '') * dir
    })
    return sorted
  }, [filterCategorieId, items, searchTerm, sortDir, sortKey])

  const stockClassName = (value) => {
    if (value < 0) return 'text-red-600 font-semibold'
    if (value < 5) return 'text-orange-600 font-semibold'
    return 'text-slate-900'
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
            Total HT (prix achat)
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {currency.format(totals.ht || 0)}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Calculé sur le stock théorique actuel, pertes exclues.
          </p>
        </div>
        <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
            Total TTC (prix vente)
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {currency.format(totals.ttc || 0)}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Basé sur le prix de vente renseigné pour chaque produit.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Valorisation du stock
            </h2>
            <p className="text-slate-500 text-sm">
              Valeur par produit avec filtres et recherche rapide
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-slate-500 mb-1">Trier</label>
              <div className="flex gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <option value="nom">Nom</option>
                  <option value="stock">Stock</option>
                  <option value="valeurHT">Valeur HT</option>
                </select>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleDownloadPdf}
              className="inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
              disabled={downloadLoading}
            >
              {downloadLoading ? 'Génération...' : 'PDF valorisation'}
            </button>
            <button
              onClick={fetchValorisation}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition"
            >
              Recharger
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="mt-2 px-3 py-2 rounded-lg border bg-red-50 border-red-200 text-red-700 text-sm">
            {downloadError}
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Recherche rapide (nom ou référence)
            </label>
            <input
              type="text"
              placeholder="Ex : baguette, REF001"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
          <div>
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
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <th className="px-3 py-2 font-semibold">Nom</th>
                <th className="px-3 py-2 font-semibold">Référence</th>
                <th className="px-3 py-2 font-semibold">Catégorie</th>
                <th className="px-3 py-2 font-semibold">Stock</th>
                <th className="px-3 py-2 font-semibold">Prix achat HT</th>
                <th className="px-3 py-2 font-semibold">Prix vente TTC</th>
                <th className="px-3 py-2 font-semibold">Valeur HT</th>
                <th className="px-3 py-2 font-semibold">Valeur TTC</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-center" colSpan={8}>
                    Calcul de la valorisation...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-4 text-center text-slate-500"
                    colSpan={8}
                  >
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.produitId}
                    className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-slate-900 font-medium">
                      {item.nom}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {item.reference || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {item.categorie || '-'}
                    </td>
                    <td className={`px-3 py-2 ${stockClassName(item.stock)}`}>
                      {item.stock}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {item.prixAchat !== null && item.prixAchat !== undefined
                        ? currency.format(item.prixAchat)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {item.prixVente !== null && item.prixVente !== undefined
                        ? currency.format(item.prixVente)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-900 font-semibold">
                      {currency.format(item.valeurHT || 0)}
                    </td>
                    <td className="px-3 py-2 text-slate-900 font-semibold">
                      {currency.format(item.valeurTTC || 0)}
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

export default Valorisation
