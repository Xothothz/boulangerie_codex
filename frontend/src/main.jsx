import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { MagasinProvider } from './context/MagasinContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MagasinProvider>
          <App />
        </MagasinProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
