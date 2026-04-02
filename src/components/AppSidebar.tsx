import { Link } from 'react-router-dom'

import { PlusMinLogo } from '@/assets/PlusMinLogo'
import { PlusLogo } from '@/assets/PlusLogo'
import { BudgetScannerHelpContent } from '@/pages/BudgetScanner/Help'

interface AppSidebarProps {
  isCollapsed: boolean
}

export function AppSidebar({ isCollapsed }: AppSidebarProps) {
  return (
    <aside className={`app-sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="App sidebar">
      <Link to="/" className="app-sidebar-logo-link" aria-label="Ga naar home">
        {isCollapsed ? (
          <div className="app-sidebar-logo-collapsed">
            <PlusLogo />
          </div>
        ) : (
          <div className="app-sidebar-logo-expanded">
            <PlusMinLogo />
          </div>
        )}
      </Link>

      <BudgetScannerHelpContent containerClassName="app-sidebar-help-render" />
    </aside>
  )
}