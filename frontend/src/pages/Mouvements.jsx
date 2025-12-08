import { useEffect, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'
import { getFilenameFromDisposition, formatWeekValue } from './StockHelpers'

function Mouvements() {
  const { token, logout } = useAuth()
  const { selectedMagasinId } = useMagasin()
  const [produits, setProduits] = useState([])
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [venteForm, setVenteForm] = useState({
    produitId: '',
    quantite: '',
    commentaire: '',
    date: '',
  })
  const [perteForm, setPerteForm] = useState({
    produitId: '',
    quantite: '',
    commentaire: '',
    date: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(formatWeekValue(new Date()))
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [importState, setImportState] = useState({
    ventes: { file: null, loading: false, error: '', result: null },
    pertes: { file: null, loading: false, error: '', result: null },
  })
  const [tab, setTab] = useState('ventes')
  const [grid, setGrid] = useState({ days: [], lignes: [] })
  const [gridLoading, setGridLoading] = useState(false)
  const tabLabel = tab === 'ventes' ? 'mises en vente' : 'pertes'
  const tabLabelTitle = tab === 'ventes' ? 'Mises en vente' : 'Pertes'

  const rowBg = (hex) => {
    if (!hex) return undefined;
    const cleaned = hex.replace('#', '');
    if (cleaned.length !== 6) return undefined;
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  };

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
      setActionError(err.message || 'Impossible de charger les produits.')
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchProduits()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const handleVenteSubmit = async (e) => {
    e.preventDefault()
    setActionError('')
    setActionMessage('')
    if (!venteForm.produitId || !venteForm.quantite) {
      setActionError('Produit et quantité sont obligatoires pour une mise en vente.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        produitId: Number(venteForm.produitId),
        quantite: Number(venteForm.quantite),
        commentaire: venteForm.commentaire.trim() || 'Mise en vente',
        date: venteForm.date || undefined,
        magasinId: selectedMagasinId,
      }
      const response = await fetch(`${API_URL}/ventes`, {
        method: 'POST',
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
        throw new Error(errorText || 'Échec de l’enregistrement de la mise en vente.')
      }
      setActionMessage('Mise en vente enregistrée.')
      setVenteForm({ produitId: '', quantite: '', commentaire: '', date: '' })
    } catch (err) {
      console.error('Erreur POST /ventes', err)
      setActionError(err.message || 'Impossible d’enregistrer la mise en vente.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePerteSubmit = async (e) => {
    e.preventDefault()
    setActionError('')
    setActionMessage('')
    if (!perteForm.produitId || !perteForm.quantite) {
      setActionError('Produit et quantité sont obligatoires pour une perte.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        produitId: Number(perteForm.produitId),
        quantite: Number(perteForm.quantite),
        commentaire: perteForm.commentaire.trim() || 'Perte',
        date: perteForm.date || undefined,
        magasinId: selectedMagasinId,
      }
      const response = await fetch(`${API_URL}/ventes/pertes`, {
        method: 'POST',
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
        throw new Error(errorText || 'Échec de l’enregistrement de la perte.')
      }
      setActionMessage('Perte enregistrée.')
      setPerteForm({ produitId: '', quantite: '', commentaire: '', date: '' })
    } catch (err) {
      console.error('Erreur POST /ventes/pertes', err)
      setActionError(err.message || 'Impossible d’enregistrer la perte.')
    } finally {
      setSubmitting(false)
    }
  }

  const triggerDownload = async (format, kind) => {
    setDownloadError('')
    setImportState((prev) => ({
      ventes: { ...prev.ventes, error: '' },
      pertes: { ...prev.pertes, error: '' },
    }))
    if (selectedMagasinId === null || selectedMagasinId === undefined) {
      setDownloadError('Sélectionnez un magasin avant de télécharger.')
      return
    }
    setDownloading(true)
    try {
      const queryMagasin = selectedMagasinId ? `&magasinId=${selectedMagasinId}` : ''
      const response = await fetch(
        `${API_URL}/semaine/feuille-${format}-${kind}?sem=${selectedWeek}${queryMagasin}`,
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
        throw new Error(errorText || 'Échec du téléchargement du fichier.')
      }
      const blob = await response.blob()
      const kindLabel = kind === 'ventes' ? 'Mises_en_vente' : 'Pertes'
      const fallbackName =
        format === 'excel'
          ? `Feuille_Semaine_${selectedWeek}_${kindLabel}.xlsx`
          : `Feuille_Semaine_${selectedWeek}_${kindLabel}.pdf`
      const filename = getFilenameFromDisposition(
        response.headers.get('content-disposition'),
        fallbackName,
      )
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error(`Erreur GET /semaine/feuille-${format}-${kind}`, err)
      setDownloadError(err.message || 'Erreur lors du téléchargement.')
    } finally {
      setDownloading(false)
    }
  }

  const handleImport = async (kind) => {
    const current = importState[kind]
    setDownloadError('')
    setImportState((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], error: '', result: null },
    }))
    if (selectedMagasinId === null || selectedMagasinId === undefined) {
      setImportState((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], error: 'Sélectionnez un magasin avant d’importer.' },
      }))
      return
    }
    if (!selectedWeek) {
      setImportState((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], error: 'Sélectionnez une semaine avant d’importer.' },
      }))
      return
    }
    if (!current.file) {
      setImportState((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], error: 'Veuillez sélectionner un fichier Excel (.xlsx).' },
      }))
      return
    }

    setImportState((prev) => ({
      ...prev,
      [kind]: { ...prev[kind], loading: true },
    }))
    try {
      const formData = new FormData()
      formData.append('file', current.file)

      const params = new URLSearchParams()
      params.set('sem', selectedWeek)
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)

      const response = await fetch(
        `${API_URL}/semaine/import-excel-${kind}?${params.toString()}`,
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
        const errorText = await response.text()
        throw new Error(errorText || 'Échec de l’import de la feuille.')
      }

      const data = await response.json()
      setImportState((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], result: data },
      }))
      await fetchGrid(tab)
    } catch (err) {
      console.error(`Erreur POST /semaine/import-excel-${kind}`, err)
      setImportState((prev) => ({
        ...prev,
        [kind]: {
          ...prev[kind],
          error: err.message || 'Erreur lors de l’import de la feuille.',
        },
      }))
    } finally {
      setImportState((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], loading: false },
      }))
    }
  }

  const globalError =
    actionError ||
    downloadError ||
    importState.ventes.error ||
    importState.pertes.error

  const fetchGrid = async (kind) => {
    setGridLoading(true)
    setDownloadError('')
    try {
      const params = new URLSearchParams()
      params.set('sem', selectedWeek)
      params.set('type', kind)
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const response = await fetch(
        `${API_URL}/stock/mouvements-semaine?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur chargement grilles.')
      }
      const data = await response.json()
      setGrid({
        days: data.days || [],
        lignes: (data.lignes || []).map((l) => ({
          ...l,
          jours: l.jours || {},
        })),
      })
    } catch (err) {
      console.error('Erreur GET /stock/mouvements-semaine', err)
      setActionError(err.message || 'Impossible de charger la grille.')
    } finally {
      setGridLoading(false)
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchGrid(tab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedMagasinId, selectedWeek])

  const updateGridCell = (produitId, dayKey, value) => {
    setGrid((prev) => ({
      ...prev,
      lignes: prev.lignes.map((l) =>
        l.produitId === produitId
          ? {
              ...l,
              jours: {
                ...l.jours,
                [dayKey]: value,
              },
            }
          : l,
      ),
    }))
  }

  const saveGrid = async () => {
    setActionError('')
    setActionMessage('')
    setGridLoading(true)
    try {
      const payload = {
        sem: selectedWeek,
        type: tab,
        lignes: grid.lignes.map((l) => ({ produitId: l.produitId, jours: l.jours })),
        magasinId: selectedMagasinId,
      }
      const response = await fetch(`${API_URL}/stock/mouvements-semaine`, {
        method: 'POST',
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
        const t = await response.text()
        throw new Error(t || 'Erreur enregistrement des mouvements.')
      }
      setActionMessage('Mouvements semaine enregistrés.')
      await fetchGrid(tab)
    } catch (err) {
      console.error('Erreur POST /stock/mouvements-semaine', err)
      setActionError(err.message || 'Impossible d’enregistrer la grille.')
    } finally {
      setGridLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {globalError}
        </div>
      )}
      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg">
          {actionMessage}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Mouvements de stock
            </h2>
            <p className="text-slate-500 text-sm">
              Enregistrer mises en vente/pertes et importer les feuilles hebdo.
            </p>
          </div>
          <button
            onClick={fetchProduits}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition"
          >
            Recharger produits
          </button>
        </div>

        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === 'ventes' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setTab('ventes')}
          >
            Mises en vente
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === 'pertes' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setTab('pertes')}
          >
            Pertes
          </button>
        </div>

        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="grid md:grid-cols-2 gap-3 flex-1">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Semaine
                </label>
                <input
                  type="week"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fichiers hebdo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => triggerDownload('excel', tab)}
                    className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-sm font-semibold transition"
                  >
                    Excel {tabLabelTitle}
                  </button>
                  <button
                    onClick={() => triggerDownload('pdf', tab)}
                    className="rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-2 text-sm font-semibold transition"
                  >
                    PDF {tabLabelTitle}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3 flex-1">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Import Excel {tabLabelTitle}
                </label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) =>
                    setImportState((prev) => ({
                      ...prev,
                      [tab]: { ...prev[tab], file: e.target.files?.[0] || null },
                    }))
                  }
                />
                <button
                  onClick={() => handleImport(tab)}
                  disabled={importState[tab].loading}
                  className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 text-sm font-semibold transition disabled:opacity-60"
                >
                  {importState[tab].loading ? 'Import...' : `Importer ${tabLabel}`}
                </button>
                {importState[tab].result && (
                  <p className="text-xs text-emerald-700">
                    {importState[tab].result.mouvements_enregistres || 0} mouvements importés
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Saisie hebdomadaire ({tabLabelTitle})
              </h3>
              <p className="text-sm text-slate-500">Modifiez les quantités par jour, par produit.</p>
            </div>
            <button
              onClick={saveGrid}
              disabled={gridLoading}
              className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            >
              {gridLoading ? 'Enregistrement...' : 'Enregistrer la grille'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <th className="px-3 py-2 font-semibold">Produit</th>
                  <th className="px-3 py-2 font-semibold">Référence</th>
                  {grid.days.map((d) => (
                    <th key={d} className="px-3 py-2 font-semibold">
                      {new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gridLoading ? (
                  <tr>
                    <td className="px-3 py-4 text-center" colSpan={grid.days.length + 2}>
                      Chargement de la grille...
                    </td>
                  </tr>
                ) : grid.lignes.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-slate-500" colSpan={grid.days.length + 2}>
                      Aucune ligne.
                    </td>
                  </tr>
                ) : (
                  grid.lignes.map((l) => (
                    <tr
                      key={l.produitId}
                      className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                      style={{ backgroundColor: rowBg(l.categorieCouleur) }}
                      title={l.categorie || ''}
                    >
                      <td className="px-3 py-2 text-slate-900 font-semibold">{l.nom}</td>
                      <td className="px-3 py-2 text-slate-700">{l.reference || '-'}</td>
                      {grid.days.map((d) => (
                        <td key={d} className="px-2 py-1">
                          <input
                            type="number"
                            min="0"
                            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                            value={l.jours?.[d] ?? ''}
                            onChange={(e) => updateGridCell(l.produitId, d, e.target.value)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Saisie mises en vente</h3>
            <form onSubmit={handleVenteSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produit
                </label>
                <select
                  value={venteForm.produitId}
                  onChange={(e) =>
                    setVenteForm((prev) => ({ ...prev, produitId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                >
                  <option value="">Choisir...</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={venteForm.quantite}
                    onChange={(e) =>
                      setVenteForm((prev) => ({ ...prev, quantite: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={venteForm.date}
                    onChange={(e) =>
                      setVenteForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Commentaire
                </label>
                <input
                  type="text"
                  value={venteForm.commentaire}
                  onChange={(e) =>
                    setVenteForm((prev) => ({ ...prev, commentaire: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 font-semibold text-sm transition disabled:opacity-60"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Saisie pertes</h3>
            <form onSubmit={handlePerteSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produit
                </label>
                <select
                  value={perteForm.produitId}
                  onChange={(e) =>
                    setPerteForm((prev) => ({ ...prev, produitId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm"
                >
                  <option value="">Choisir...</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantité
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={perteForm.quantite}
                    onChange={(e) =>
                      setPerteForm((prev) => ({ ...prev, quantite: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date (optionnel)
                  </label>
                  <input
                    type="datetime-local"
                    value={perteForm.date}
                    onChange={(e) =>
                      setPerteForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Commentaire
                </label>
                <input
                  type="text"
                  value={perteForm.commentaire}
                  onChange={(e) =>
                    setPerteForm((prev) => ({ ...prev, commentaire: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 font-semibold text-sm transition disabled:opacity-60"
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Mouvements
