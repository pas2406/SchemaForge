import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Polices chargées via Google Fonts dans index.html (Fraunces, IBM Plex Sans/Mono).
import './index.css'
import App from './App.jsx'
import FournisseurLangue from './i18n/FournisseurLangue'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FournisseurLangue>
      <App />
    </FournisseurLangue>
  </StrictMode>,
)
