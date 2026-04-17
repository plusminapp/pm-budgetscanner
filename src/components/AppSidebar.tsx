import { Link } from 'react-router-dom'

import { PlusMinLogo } from '@/assets/PlusMinLogo'
import { BudgetScannerHelpContent } from '@/pages/BudgetScanner/Help'

interface AppSidebarProps {
  isCollapsed: boolean
}

export function AppSidebar({ isCollapsed }: AppSidebarProps) {
  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="App sidebar">
      <div className="app-sidebar-header">
        <Link to="/" className="app-sidebar-logo-link" aria-label="Ga naar home">
          <div className="app-sidebar-logo-expanded">
            <PlusMinLogo />
          </div>
        </Link>
      </div>

      <BudgetScannerHelpContent containerClassName="app-sidebar-help-render" />
    </aside>
  )
}