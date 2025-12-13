import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Parametres from './pages/Parametres'
import Produits from './pages/Produits'
import Stock from './pages/Stock'
import Commandes from './pages/Commandes'
import { useAuth } from './context/AuthContext'
import Inventaire from './pages/Inventaire'
import Historique from './pages/Historique'
import Mouvements from './pages/Mouvements'
import PendingAffectation from './pages/PendingAffectation'
import Profil from './pages/Profil'
import Valorisation from './pages/Valorisation'

function PrivateRoute({ children }) {
  const { token, initializing, user, logout } = useAuth()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Chargement de la session...
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin && user && !user.magasinId) {
    return <PendingAffectation onLogout={logout} user={user} />
  }

  return children
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/produits" replace />} />
      <Route
        path="/tableau-de-bord"
        element={
          <PrivateRoute>
            <Layout title="Tableau de bord">
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/commandes"
        element={
          <PrivateRoute>
            <Layout title="Commandes">
              <Commandes />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/produits"
        element={
          <PrivateRoute>
            <Layout title="Produits">
              <Produits />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <PrivateRoute>
            <Layout title="Stock produits">
              <Stock />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/valorisation"
        element={
          <PrivateRoute>
            <Layout title="Valorisation du stock">
              <Valorisation />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/mouvements"
        element={
          <PrivateRoute>
            <Layout title="Mouvements de stock">
              <Mouvements />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/inventaire"
        element={
          <PrivateRoute>
            <Layout title="Inventaire">
              <Inventaire />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/historique"
        element={
          <PrivateRoute>
            <Layout title="Historique">
              <Historique />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/parametres"
        element={
          <PrivateRoute>
            <Layout title="Paramètres">
              <Parametres />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/profil"
        element={
          <PrivateRoute>
            <Layout title="Mon profil">
              <Profil />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/produits" replace />} />
    </Routes>
  )
}

export default App
