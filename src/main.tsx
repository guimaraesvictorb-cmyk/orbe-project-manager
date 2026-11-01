import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SharedDashboardPage } from './components/SharedDashboardPage.tsx'
import {ClientDashboardPage} from './components/ClientDashboardPage.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

const clientDashboardToken=/^#\/cliente\/([A-Za-z0-9_-]{43})$/.exec(window.location.hash)?.[1]
const shareToken = new URLSearchParams(window.location.search).get('share')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clientDashboardToken?<ClientDashboardPage token={clientDashboardToken}/>:<AuthProvider>
      {shareToken ? <SharedDashboardPage token={shareToken} /> : <App />}
    </AuthProvider>}
  </StrictMode>,
)
