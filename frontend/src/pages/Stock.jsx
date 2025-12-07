import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

function Stock() {
  const { token, logout } = useAuth()
  const { selectedMagasinId } = useMagasin()
  const [stock, setStock] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategorieId, setFilterCategorieId] = useState('')
  const [sortKey, setSortKey] = useState('nom')
  const [sortDir, setSortDir] = useState('asc')

  const fetchStock = async () => {
    setLoading(true)
    setError('')
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
        throw new Error(errorText || 'Erreur lors du chargement du stock.')
      }
      const data = await response.json()
      setStock(data)
    } catch (err) {
      console.error('Erreur GET /stock/produits', err)
      setError(err.message || 'Impossible de récupérer le stock.')
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
        throw new Error(errorText || 'Erreur lors du chargement des catégories.')
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
      fetchStock()
      fetchCategories()
    }
  }, [selectedMagasinId])

  const filteredStock = useMemo(() => {
    let list = stock
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
        (item) =>
          String(item.categorieId || '') === String(filterCategorieId) ||
          String(item.categorieRef?.id || '') === String(filterCategorieId) ||
          item.categorie ===
            categories.find((c) => String(c.id) === String(filterCategorieId))?.nom,
    )
  }
    const sorted = [...list].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'nom') {
        return (a.nom || '').localeCompare(b.nom || '') * dir
      }
      if (sortKey === 'stock') {
        return ((a.stock || 0) - (b.stock || 0)) * dir
      }
      return 0
    })
    return sorted
  }, [categories, filterCategorieId, searchTerm, sortDir, sortKey, stock])

  const stockClassName = (value) => {
    if (value < 0) return 'text-red-600 font-semibold'
    if (value < 5) return 'text-orange-600 font-semibold'
    return 'text-slate-900'
  }

  const joursRestants = (item) => {
    const qj = item.quantiteJour || 0
    if (!qj || qj <= 0) return '-'
    const days = (item.stock || 0) / qj
    if (days < 0) return '0'
    return days.toFixed(1)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Stock produits
            </h2>
            <p className="text-slate-500 text-sm">
              Stock théorique agrégé par produit
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
              onClick={fetchStock}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition"
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
              placeholder="Ex : croissant, REF001"
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
                <th className="px-3 py-2 font-semibold">Jours restants</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-center" colSpan={5}>
                    Chargement du stock...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                filteredStock.map((item) => (
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
                    {joursRestants(item)}
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

export default Stock
