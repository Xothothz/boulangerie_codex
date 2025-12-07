import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMagasin } from '../context/MagasinContext'

const navItems = [
  { to: '/tableau-de-bord', label: 'Tableau de bord' },
  { to: '/produits', label: 'Produits' },
  { to: '/stock', label: 'Stock' },
  { to: '/commandes', label: 'Commandes' },
  { to: '/mouvements', label: 'Mouvements de stock' },
  { to: '/inventaire', label: 'Inventaire' },
  { to: '/historique', label: 'Historique' },
  { to: '/parametres', label: 'Paramètres' },
]

function Layout({ title, children }) {
  const formattedDate = new Date().toLocaleDateString('fr-FR')
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { magasins, selectedMagasinId, setSelectedMagasinId, loading, error } =
    useMagasin()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      <aside className="w-64 bg-emerald-900 text-white flex flex-col shadow-lg">
        <div className="p-6 border-b border-emerald-800">
          <p className="text-sm uppercase tracking-wide text-emerald-200">
            Lambert Gestion
          </p>
          <p className="text-lg font-semibold">Boulangerie</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-emerald-700 text-white'
                    : 'text-emerald-100 hover:bg-emerald-800 hover:text-white',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-xs text-emerald-100 border-t border-emerald-800">
          Aujourd&apos;hui : {formattedDate}
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-700 font-semibold">
              Lambert Gestion : Boulangerie
            </p>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-slate-900 font-semibold">
                {user?.nom || 'Utilisateur'}
              </p>
              <p className="text-xs text-slate-500">
                {user?.email || 'Compte non renseigné'}
              </p>
            </div>
            <div className="flex flex-col text-right">
              <label className="text-xs font-semibold text-slate-500">
                Magasin
              </label>
              {error ? (
                <p className="text-xs text-red-600">{error}</p>
              ) : magasins.length <= 1 ? (
                <p className="text-sm text-slate-700">
                  {magasins[0]?.nom || 'Aucun'}
                </p>
              ) : (
                <select
                  value={selectedMagasinId || ''}
                  onChange={(e) => setSelectedMagasinId(Number(e.target.value))}
                  disabled={loading}
                  className="text-sm border border-slate-300 rounded px-2 py-1"
                >
                  {magasins.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Se déconnecter
            </button>
          </div>
        </header>
        <div className="p-6 flex-1">{children}</div>
      </main>
    </div>
  )
}

export default Layout
