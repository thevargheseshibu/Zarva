import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// AG Grid v35+ requires module registration before any grid renders
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
ModuleRegistry.registerModules([AllCommunityModule])

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
