import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { MagasinProvider } from './context/MagasinContext.jsx'
import './index.css'

// Détection automatique du contexte de déploiement
// - /boulangerie/...  → portail (basename = /boulangerie)
// - sous-domaine      → racine (basename = '')
const basename = window.location.pathname.startsWith('/boulangerie')
  ? '/boulangerie'
  : ''

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <MagasinProvider>
          <App />
        </MagasinProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
