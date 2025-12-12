import { useEffect, useMemo, useState } from 'react'
import { API_URL } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

const numberFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

function Commandes() {
  const { token, logout } = useAuth()
  const { selectedMagasinId } = useMagasin()

  const [produits, setProduits] = useState([])
  const [proposition, setProposition] = useState(null)
  const [loadingProp, setLoadingProp] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })

  const [pending, setPending] = useState([])
  const [receptionInputs, setReceptionInputs] = useState({})

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const fetchProduits = async () => {
    try {
      const query = selectedMagasinId ? `?magasinId=${selectedMagasinId}` : ''
      const response = await fetch(`${API_URL}/produits${query}`, {
        headers: authHeaders,
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      const data = await response.json()
      setProduits(data.filter((p) => p.unitesCarton))
    } catch (err) {
      console.error('Erreur GET /produits', err)
      setError(err.message || 'Erreur chargement produits')
    }
  }

  const fetchProposition = async () => {
    if (!selectedDate) return
    setLoadingProp(true)
    setError('')
    setMessage('')
    try {
      const params = new URLSearchParams()
      params.set('dateCommande', selectedDate)
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const response = await fetch(
        `${API_URL}/commandes/proposition?${params.toString()}`,
        { headers: authHeaders },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur calcul proposition')
      }
      const data = await response.json()
      setProposition(data)
    } catch (err) {
      console.error('Erreur proposition', err)
      setError(err.message || 'Impossible de calculer la proposition')
    } finally {
      setLoadingProp(false)
    }
  }

  const fetchPending = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
      const response = await fetch(
        `${API_URL}/commandes/en-attente?${params.toString()}`,
        { headers: authHeaders },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur chargement commandes en attente')
      }
      const data = await response.json()
      setPending(data)
    } catch (err) {
      console.error('Erreur en-attente', err)
      setError(err.message || 'Impossible de charger les commandes')
    }
  }

  useEffect(() => {
    if (selectedMagasinId !== null && selectedMagasinId !== undefined) {
      fetchProduits()
      fetchPending()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMagasinId])

  const updateCartons = (produitId, cartons) => {
    setProposition((prev) => {
      if (!prev) return prev
      const lignes = prev.lignes.map((l) =>
        l.produitId === produitId
          ? {
              ...l,
              cartonsProposes: Math.max(0, Number(cartons) || 0),
              totalUnites:
                Math.max(0, Number(cartons) || 0) * (l.unitesParCarton || 0),
            }
          : l,
      )
      return { ...prev, lignes }
    })
  }

  const removeLigne = (produitId) => {
    setProposition((prev) => {
      if (!prev) return prev
      return { ...prev, lignes: prev.lignes.filter((l) => l.produitId !== produitId) }
    })
  }

  const [addProductId, setAddProductId] = useState('')
  const [addCartons, setAddCartons] = useState('1')

  const handleAddProduct = () => {
    const pid = Number(addProductId)
    if (!pid || !proposition) return
    const prod = produits.find((p) => p.id === pid)
    if (!prod || !prod.unitesCarton) return
    setProposition((prev) => {
      if (!prev) return prev
      if (prev.lignes.some((l) => l.produitId === pid)) return prev
      const cartons = Math.max(0, Number(addCartons) || 0)
      const line = {
        produitId: pid,
        nom: prod.nom,
        ifls: prod.ifls || '',
        ean13: prod.ean13 || '',
        cartonsProposes: cartons,
        unitesParCarton: prod.unitesCarton || 0,
        totalUnites: cartons * (prod.unitesCarton || 0),
        stockActuel: 0,
        stockTheorique: 0,
        enAttente: 0,
        quantiteJour: prod.quantiteJour || 0,
        frequenceJours: prod.frequenceJours || 1,
        categorie: prod.categorie || prod.categorieRef?.nom || '',
      }
      return { ...prev, lignes: [...prev.lignes, line] }
    })
  }

  const handleValidate = async () => {
    if (!proposition || !proposition.lignes || proposition.lignes.length === 0) {
      setError('Aucune ligne à valider.')
      return
    }
    setError('')
    setMessage('')
    try {
      const payload = {
        dateCommande: proposition.dateCommande,
        dateLivraisonPrevue: proposition.dateLivraisonPrevue,
        lignes: proposition.lignes.map((l) => ({
          produitId: l.produitId,
          cartons: l.cartonsProposes,
        })),
      }
      if (selectedMagasinId) payload.magasinId = selectedMagasinId
      const response = await fetch(`${API_URL}/commandes/valider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(payload),
      })
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors de la validation')
      }
      setMessage('Commande validée et enregistrée.')
      setProposition(null)
      await fetchPending()
    } catch (err) {
      console.error('Erreur validation commande', err)
      setError(err.message || 'Impossible de valider la commande')
    }
  }

  const handleReceptionChange = (commandeId, ligneId, value) => {
    setReceptionInputs((prev) => ({
      ...prev,
      [commandeId]: { ...(prev[commandeId] || {}), [ligneId]: value },
    }))
  }

  const handleReception = async (commande) => {
    const params = new URLSearchParams()
    if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    const payloadLignes = (commande.lignes || [])
      .map((l) => {
        const val = receptionInputs[commande.id]?.[l.id]
        const cartonsRecus = Number(val) || 0
        return cartonsRecus > 0
          ? { produitId: l.produitId, cartonsRecus }
          : null
      })
      .filter(Boolean)
    if (payloadLignes.length === 0) {
      setError('Aucune quantité reçue indiquée.')
      return
    }
    try {
      const response = await fetch(
        `${API_URL}/commandes/${commande.id}/recevoir${suffix}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ lignes: payloadLignes }),
        },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors de la réception')
      }
      setMessage('Réception enregistrée.')
      await fetchPending()
    } catch (err) {
      console.error('Erreur réception', err)
      setError(err.message || 'Impossible de réceptionner')
    }
  }

  const handleAnnuler = async (commandeId) => {
    const params = new URLSearchParams()
    if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    try {
      const response = await fetch(
        `${API_URL}/commandes/${commandeId}/annuler${suffix}`,
        {
          method: 'POST',
          headers: authHeaders,
        },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur lors de l’annulation')
      }
      setMessage('Commande annulée.')
      await fetchPending()
    } catch (err) {
      console.error('Erreur annulation', err)
      setError(err.message || 'Impossible d’annuler')
    }
  }

  const handleDownloadLog = async (commandeId) => {
    const params = new URLSearchParams()
    if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
    const suffix = params.toString() ? `?${params.toString()}` : ''

    try {
      const response = await fetch(
        `${API_URL}/commandes/${commandeId}/log-txt${suffix}`,
        { headers: authHeaders },
      )
      if (response.status === 401) {
        logout()
        throw new Error('Session expirée, merci de vous reconnecter.')
      }
      if (!response.ok) {
        const t = await response.text()
        throw new Error(t || 'Erreur log commande')
      }

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename=\"?([^\";]+)\"?/)
      const downloadName = match?.[1] || `Commande_${commandeId}.txt`

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = downloadName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur log commande', err)
      setError(err.message || 'Impossible de télécharger le log commande.')
    }
  }

  const handleDownloadPdf = async (commandeId) => {
    const params = new URLSearchParams()
    if (selectedMagasinId) params.set('magasinId', selectedMagasinId)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    try {
      const response = await fetch(
        `${API_URL}/commandes/${commandeId}/pdf${suffix}`,
        {
          headers: authHeaders,
        },
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
      link.download = `Commande_${commandeId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur PDF commande', err)
      setError(err.message || 'Impossible de générer le PDF')
    }
  }

  const propositionTotalCartons = useMemo(
    () =>
      (proposition?.lignes || []).reduce(
        (acc, l) => acc + (Number(l.cartonsProposes) || 0),
        0,
      ),
    [proposition?.lignes],
  )

  const propositionTotalUnites = useMemo(
    () =>
      (proposition?.lignes || []).reduce(
        (acc, l) => acc + (Number(l.totalUnites) || 0),
        0,
      ),
    [proposition?.lignes],
  )

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

      {/* Bloc commande automatique */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Commande automatique
            </h2>
            <p className="text-sm text-slate-500">
              Calcul basée sur stocks, mises en vente/pertes semaine, en
              attente, cartons.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-slate-300 rounded px-2 py-2 text-sm"
            />
            <button
              onClick={fetchProposition}
              disabled={loadingProp}
              className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {loadingProp ? 'Calcul...' : 'Générer'}
            </button>
          </div>
        </div>

        {proposition && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span>
                Date commande :{' '}
                <strong>
                  {new Date(proposition.dateCommande).toLocaleDateString(
                    'fr-FR',
                  )}
                </strong>
              </span>
              <span>
                Livraison prévue :{' '}
                <strong>
                  {new Date(
                    proposition.dateLivraisonPrevue,
                  ).toLocaleDateString('fr-FR')}
                </strong>
              </span>
              {proposition.prochaineLivraison && (
                <span>
                  Prochaine livraison après :{' '}
                  <strong>
                    {new Date(
                      proposition.prochaineLivraison,
                    ).toLocaleDateString('fr-FR')}
                  </strong>
                </span>
              )}
              {proposition.livraisonSuivante && (
                <span>
                  Livraison suivante :{' '}
                  <strong>
                    {new Date(
                      proposition.livraisonSuivante,
                    ).toLocaleDateString('fr-FR')}
                  </strong>
                </span>
              )}
              <span>
                Jours à couvrir : <strong>{proposition.joursACouvrir}</strong>
              </span>
              <span>
                Total cartons :{' '}
                <strong>{propositionTotalCartons}</strong>
              </span>
              <span>
                Total unités :{' '}
                <strong>{propositionTotalUnites}</strong>
              </span>
              <span className="text-xs text-slate-500">
                Détail : besoin = (quantiteJour / frequenceJours × jours) – stock actuel
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={addProductId}
                onChange={(e) => setAddProductId(e.target.value)}
                className="border border-slate-300 rounded px-2 py-2 text-sm"
              >
                <option value="">Ajouter un produit...</option>
                {produits
                  .filter(
                    (p) =>
                      !proposition.lignes.some(
                        (l) => l.produitId === p.id,
                      ),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nom} ({p.unitesCarton} u/carton)
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="0"
                value={addCartons}
                onChange={(e) => setAddCartons(e.target.value)}
                className="w-24 border border-slate-300 rounded px-2 py-2 text-sm"
                placeholder="Cartons"
              />
              <button
                onClick={handleAddProduct}
                className="rounded bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 text-sm font-semibold"
              >
                Ajouter
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                    <th className="px-3 py-2 text-left font-semibold">IFLS</th>
                    <th className="px-3 py-2 text-left font-semibold">Produit</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Catégorie
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Cartons
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      u/carton
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Total u.
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Conso estimée
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Besoin brut
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Stock
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      En attente
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {proposition.lignes.length === 0 ? (
                    <tr>
                      <td
                        className="px-3 py-3 text-center text-slate-500"
                        colSpan={11}
                      >
                        Aucune ligne proposée.
                      </td>
                    </tr>
                  ) : (
                    proposition.lignes.map((l) => (
                      <tr
                        key={l.produitId}
                        className="border-b last:border-0 border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2 text-slate-600">
                          {l.ifls || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-900 font-semibold">
                          {l.nom}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {l.categorie || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            value={l.cartonsProposes}
                            onChange={(e) =>
                              updateCartons(l.produitId, e.target.value)
                            }
                            className="w-20 border border-slate-300 rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {l.unitesParCarton}
                        </td>
                        <td className="px-3 py-2 text-slate-700 font-semibold">
                          {numberFmt.format(l.totalUnites || 0)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {numberFmt.format(l.consommationEstimee || 0)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {numberFmt.format(l.besoinUnites || 0)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {numberFmt.format(l.stockActuel || 0)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {numberFmt.format(l.enAttente || 0)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeLigne(l.produitId)}
                            className="text-sm text-red-600 hover:text-red-800 font-semibold"
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleValidate}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold"
              >
                Valider la commande
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bloc réception commandes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Réception commandes
            </h2>
            <p className="text-sm text-slate-500">
              Réception partielle ou totale, ou annulation.
            </p>
          </div>
          <button
            onClick={fetchPending}
            className="rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-sm font-semibold"
          >
            Rafraîchir
          </button>
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune commande en attente.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((c) => (
              <div
                key={c.id}
                className="border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    Commande #{c.id}
                  </span>
                  <span className="text-xs text-slate-500">
                    Commande du{' '}
                    {new Date(c.dateCommande).toLocaleDateString('fr-FR')}
                  </span>
                  <span className="text-xs text-slate-500">
                    Livraison prévue{' '}
                    {new Date(
                      c.dateLivraisonPrevue,
                    ).toLocaleDateString('fr-FR')}
                  </span>
                  <span className="text-xs text-slate-500">
                    Statut : {c.statut.replace('_', ' ')}
                  </span>

                  {/* Boutons d'action à droite */}
                  <div className="flex items-center gap-3 ml-auto">
                    <button
                      onClick={() => handleDownloadLog(c.id)}
                      className="text-sm text-sky-700 hover:text-sky-900 font-semibold"
                    >
                      Log commande (.txt)
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(c.id)}
                      className="text-sm text-emerald-700 hover:text-emerald-900 font-semibold"
                    >
                      PDF
                    </button>
                    <button
                      onClick={() => handleAnnuler(c.id)}
                      className="text-sm text-red-600 hover:text-red-800 font-semibold"
                    >
                      Annuler
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200">
                        <th className="px-3 py-2 text-left font-semibold">
                          IFLS
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Produit
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Cartons
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Unités
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Reçues (u.)
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Restant (u.)
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Saisir reçues (cartons)
                        </th>
                        <th className="px-3 py-2 text-left font-semibold">
                          Tout reçu ?
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.lignes.map((l) => (
                        <tr
                          key={l.id}
                          className="border-b last:border-0 border-slate-100"
                        >
                          <td className="px-3 py-2 text-slate-600">
                            {l.produit?.ifls || '-'}
                          </td>
                          <td className="px-3 py-2 text-slate-900">
                            {l.produit?.nom}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {l.cartons}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {l.unites}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {l.unitesRecues} / {l.unites}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {l.unites - l.unitesRecues}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max={
                                l.unitesParCarton
                                  ? Math.ceil(
                                      (l.unites - l.unitesRecues) /
                                        l.unitesParCarton,
                                    )
                                  : undefined
                              }
                              value={
                                receptionInputs[c.id]?.[l.id] !==
                                undefined
                                  ? receptionInputs[c.id][l.id]
                                  : ''
                              }
                              onChange={(e) =>
                                handleReceptionChange(
                                  c.id,
                                  l.id,
                                  e.target.value,
                                )
                              }
                              className="w-24 border border-slate-300 rounded px-2 py-1 text-sm"
                              placeholder="Cartons"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  !l.unitesParCarton ||
                                  l.unitesParCarton <= 0
                                )
                                  return
                                const restant = Math.max(
                                  0,
                                  l.unites - l.unitesRecues,
                                )
                                const cartons = Math.ceil(
                                  restant / l.unitesParCarton,
                                )
                                handleReceptionChange(
                                  c.id,
                                  l.id,
                                  cartons,
                                )
                              }}
                              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                            >
                              Tout reçu
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleReception(c)}
                    className="rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-sm font-semibold"
                  >
                    Enregistrer la réception
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Commandes
