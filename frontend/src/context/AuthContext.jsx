import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { API_URL } from '../config/api'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const normalizeUser = (value) => {
    if (!value) return null
    return {
      ...value,
      permissions: Array.isArray(value.permissions) ? value.permissions : [],
    }
  }

  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? normalizeUser(JSON.parse(stored)) : null
  })
  const [profileRefreshing, setProfileRefreshing] = useState(false)
  const [initializing, setInitializing] = useState(true)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }, [])

  const login = useCallback((newToken, newUser) => {
    const normalized = normalizeUser(newUser)
    setToken(newToken)
    setUser(normalized)
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(normalized))
  }, [])

  useEffect(() => {
    if (!token) {
      setInitializing(false)
      return
    }

    const fetchMe = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Session expirée')
        }

        const data = await response.json()
        const normalized = normalizeUser(data.user)
        setUser(normalized)
        localStorage.setItem('user', JSON.stringify(normalized))
      } catch (err) {
        console.error('Erreur /auth/me', err)
        logout()
      } finally {
        setInitializing(false)
      }
    }

    fetchMe()
  }, [logout, token])

  const refreshProfile = useCallback(async () => {
    if (!token) return
    setProfileRefreshing(true)
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Erreur chargement profil')
      const data = await response.json()
      const normalized = normalizeUser(data.user)
      setUser(normalized)
      localStorage.setItem('user', JSON.stringify(normalized))
    } catch (err) {
      console.error('Erreur refresh profile', err)
    } finally {
      setProfileRefreshing(false)
    }
  }, [token])

  const value = useMemo(
    () => ({ token, user, login, logout, initializing, refreshProfile, profileRefreshing, setUser }),
    [token, user, login, logout, initializing, refreshProfile, profileRefreshing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider')
  }
  return context
}
