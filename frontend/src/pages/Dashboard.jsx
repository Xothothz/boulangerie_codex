import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

const numberFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const moneyFmt = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function Card({ title, value, hint, accent = 'emerald' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    red: 'bg-rose-50 text-rose-800 border-rose-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    slate: 'bg-slate-50 text-slate-800 border-slate-100',
  }

  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${colors[accent]}`}>
      <p className="text-xs uppercase tracking-wide font-semibold">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs mt-1 opacity-80">{hint}</p>}
    </div>
  )
}

function Dashboard() {
  const { token, logout } = useAuth()
  const { selectedMagasinId } = useMagasin()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [produits, setProduits] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 13)
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      produitId: '',
      categorieId: '',
    }
  })

  const fetchStats = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filters.start) params.set('start', filters.start)
      if (filters.end) params.set('end', filters.end)
      if (filters.produitId) params.set('produitId', filters.produitId)
      if (filters.categorieId) params.set('categorieId', filters.categorieId)
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)

      const response = await fetch(`${API_URL}/stats/overview?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Erreur lors du chargement des statistiques.')
      }
      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Erreur GET /stats/overview', err)
      setError(err.message || 'Impossible de charger les statistiques.')
    } finally {
      setLoading(false)
    }
  }

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
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des produits.')
      }
      const data = await response.json()
      setProduits(data)
    } catch (err) {
      console.error('Erreur GET /produits', err)
      setError(err.message || 'Impossible de charger les produits.')
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
      fetchStats()
      fetchProduits()
      fetchCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const periodeLabel = useMemo(() => {
    if (!stats?.period) return ''
    const format = (iso) =>
      new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    return `Du ${format(stats.period.start)} au ${format(stats.period.end)}`
  }, [stats?.period])

  const dailyRows = stats?.daily || []
  const maxBar = dailyRows.reduce(
    (acc, row) => Math.max(acc, row.ventes || 0, row.pertes || 0),
    0,
  ) || 1

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white shadow-sm rounded-xl p-6 border border-slate-100">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Tableau de bord
            </h2>
            <p className="text-slate-500 text-sm">
              Synthèse ventes / pertes / marge sur la période sélectionnée. {periodeLabel}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex flex-col text-xs text-slate-600">
              <label>Du</label>
              <input
                type="date"
                value={filters.start}
                onChange={(e) => setFilters((prev) => ({ ...prev, start: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-1"
              />
            </div>
            <div className="flex flex-col text-xs text-slate-600">
              <label>Au</label>
              <input
                type="date"
                value={filters.end}
                onChange={(e) => setFilters((prev) => ({ ...prev, end: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-1"
              />
            </div>
            <div className="flex flex-col text-xs text-slate-600">
              <label>Produit</label>
              <select
                value={filters.produitId}
                onChange={(e) => setFilters((prev) => ({ ...prev, produitId: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-1 text-sm min-w-[160px]"
              >
                <option value="">Tous</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col text-xs text-slate-600">
              <label>Catégorie</label>
              <select
                value={filters.categorieId}
                onChange={(e) => setFilters((prev) => ({ ...prev, categorieId: e.target.value }))}
                className="rounded border border-slate-200 px-2 py-1 text-sm min-w-[160px]"
              >
                <option value="">Toutes</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {loading ? 'Rafraîchissement...' : 'Rafraîchir'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mt-6">
          <Card
            title="Ventes (unités)"
            value={numberFmt.format(stats?.totals?.ventes || 0)}
            hint="Somme des sorties Vente"
            accent="emerald"
          />
          <Card
            title="Pertes (unités)"
            value={numberFmt.format(stats?.totals?.pertes || 0)}
            hint="Somme des sorties Perte"
            accent="amber"
          />
          <Card
            title="Marge estimée (€)"
            value={`${moneyFmt.format(stats?.totals?.margeEstimee || 0)} €`}
            hint="(Prix vente - achat) x quantités vendues"
            accent="slate"
          />
          <Card
            title="Ruptures / bas stock"
            value={`${stats?.stock?.ruptures || 0} / ${stats?.stock?.bas || 0}`}
            hint="Produits à suivre"
            accent="red"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Ventes / Pertes par jour
              </h3>
              <p className="text-xs text-slate-500">Période sélectionnée</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                    <th className="px-3 py-2 text-left font-semibold">Ventes</th>
                    <th className="px-3 py-2 text-left font-semibold">Pertes</th>
                    <th className="px-3 py-2 text-left font-semibold">Graph</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-center text-slate-500" colSpan={3}>
                        Aucune donnée sur la période.
                      </td>
                    </tr>
                    ) : (
                      dailyRows.map((row) => (
                        <tr key={row.date} className="border-b last:border-0 border-slate-100">
                          <td className="px-3 py-2 text-slate-700">
                            {new Date(row.date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </td>
                          <td className="px-3 py-2 text-emerald-700 font-semibold">
                            {numberFmt.format(row.ventes || 0)}
                          </td>
                          <td className="px-3 py-2 text-amber-700 font-semibold">
                            {numberFmt.format(row.pertes || 0)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <div
                                className="h-2 rounded-full bg-emerald-600"
                                style={{
                                  width: `${Math.max(4, (row.ventes / maxBar) * 100)}%`,
                                  opacity: 0.7,
                                }}
                              />
                              <div
                                className="h-2 rounded-full bg-amber-500"
                                style={{
                                  width: `${Math.max(4, (row.pertes / maxBar) * 100)}%`,
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Top ventes (unités)
              </h3>
              <p className="text-xs text-slate-500">Période sélectionnée</p>
            </div>
            {(!stats?.topVentes || stats.topVentes.length === 0) && (
              <p className="text-sm text-slate-500">Aucune vente sur la période.</p>
            )}
            <div className="space-y-3">
              {stats?.topVentes?.map((p) => (
                <div
                  key={p.produitId}
                  className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{p.nom}</p>
                    <p className="text-xs text-slate-500">
                      {p.reference || 'Sans ref.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-emerald-700 font-semibold">
                      {numberFmt.format(p.quantite)} u.
                    </p>
                    <p className="text-xs text-slate-500">
                      CA est. {moneyFmt.format(p.chiffreAffaires || 0)} €
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Top pertes (unités)
              </h3>
              <p className="text-xs text-slate-500">Période sélectionnée</p>
            </div>
            {(!stats?.topPertes || stats.topPertes.length === 0) && (
              <p className="text-sm text-slate-500">Aucune perte sur la période.</p>
            )}
            <div className="space-y-3">
              {stats?.topPertes?.map((p) => (
                <div
                  key={p.produitId}
                  className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{p.nom}</p>
                    <p className="text-xs text-slate-500">
                      {p.reference || 'Sans ref.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-amber-700 font-semibold">
                      {numberFmt.format(p.quantite)} u.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
