import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'

const AdminApp = lazy(() => import('./admin/AdminApp'))
const path = location.pathname.replace(/\/+$/, '')
const AccountApp = lazy(() => import('./account/AccountApp'))
const isAdminRoute = path === '/admin' || path.startsWith('/admin/')
const isAccountRoute = path === '/account'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <Suspense fallback={null}><AdminApp /></Suspense>
    ) : (
      <AuthProvider>
        {isAccountRoute ? <Suspense fallback={null}><AccountApp /></Suspense> : <App />}
      </AuthProvider>
    )}
  </StrictMode>,
)
