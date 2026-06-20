import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './security/ErrorBoundary.jsx'
import { OfflineSyncProvider } from './providers/OfflineSyncProvider'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <OfflineSyncProvider>
        <App />
      </OfflineSyncProvider>
    </ErrorBoundary>
  </StrictMode>,
)
