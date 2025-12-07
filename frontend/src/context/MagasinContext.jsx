import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { API_URL } from '../config/api'
import { useAuth } from './AuthContext'

const MagasinContext = createContext(undefined)

export function MagasinProvider({ children }) {
  const { token, user, logout } = useAuth()
  const [magasins, setMagasins] = useState([])
  const [selectedMagasinId, setSelectedMagasinId] = useState(() => {
    const stored = localStorage.getItem('selectedMagasinId')
    return stored ? Number(stored) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchMagasins = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_URL}/magasins`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.status === 401) {
        logout()
        throw new Error('Session expirée')
      }
      if (response.status === 403) {
        const msg =
          'Vous devez être affecté à un magasin par un administrateur pour accéder aux données.'
        throw new Error(msg)
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors du chargement des magasins.')
      }

      const data = await response.json()
      setMagasins(data)

      if (data.length > 0) {
        const current =
          selectedMagasinId && data.some((m) => m.id === selectedMagasinId)
            ? selectedMagasinId
            : data[0].id
        setSelectedMagasinId(current)
        localStorage.setItem('selectedMagasinId', String(current))
      } else {
        setSelectedMagasinId(null)
        localStorage.removeItem('selectedMagasinId')
      }
    } catch (err) {
      console.error('Erreur GET /magasins', err)
      setError(err.message || 'Impossible de charger les magasins.')
    } finally {
      setLoading(false)
    }
  }, [logout, selectedMagasinId, token])

  useEffect(() => {
    if (!token) {
      setMagasins([])
      setSelectedMagasinId(null)
      return
    }
    fetchMagasins()
  }, [fetchMagasins, token])

  useEffect(() => {
    if (user?.magasinId && !selectedMagasinId) {
      setSelectedMagasinId(user.magasinId)
      localStorage.setItem('selectedMagasinId', String(user.magasinId))
    }
  }, [selectedMagasinId, user?.magasinId])

  const value = useMemo(
    () => ({
      magasins,
      selectedMagasinId,
      setSelectedMagasinId: (id) => {
        setSelectedMagasinId(id)
        if (id) {
          localStorage.setItem('selectedMagasinId', String(id))
        } else {
          localStorage.removeItem('selectedMagasinId')
        }
      },
      loading,
      error,
      refreshMagasins: fetchMagasins,
    }),
    [error, fetchMagasins, loading, magasins, selectedMagasinId],
  )

  return (
    <MagasinContext.Provider value={value}>
      {children}
    </MagasinContext.Provider>
  )
}

export function useMagasin() {
  const context = useContext(MagasinContext)
  if (!context) {
    throw new Error('useMagasin doit être utilisé dans un MagasinProvider')
  }
  return context
}
