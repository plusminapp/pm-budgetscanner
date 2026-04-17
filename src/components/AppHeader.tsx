import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PlusMinLogo } from '@/assets/PlusMinLogo'

interface AppHeaderProps {
  isCollapsed: boolean
  setIsCollapsed: (collapsed: boolean) => void
  isMobileSidebarOpen: boolean
  setIsMobileSidebarOpen: (open: boolean) => void
}

export function AppHeader({ isCollapsed, setIsCollapsed, isMobileSidebarOpen, setIsMobileSidebarOpen }: AppHeaderProps) {
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const isHelpVisible = isMobile ? isMobileSidebarOpen : !isCollapsed
  const toggleLabel = isHelpVisible ? 'Help verbergen' : 'Help tonen'
  const shouldShowRightChevron = isMobile ? !isMobileSidebarOpen : isCollapsed

  const handleToggle = () => {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setIsMobileSidebarOpen(!isMobileSidebarOpen)
      return
    }
    setIsCollapsed(!isCollapsed)
  }

  return (
    <header className="app-header">
      {(!isHelpVisible || isMobile) && (
        <Link to="/" className="app-header-logo-link" aria-label="Ga naar home">
          <div className="app-header-logo">
            <PlusMinLogo />
          </div>
        </Link>
      )}

      <button
        className="app-header-toggle"
        onClick={handleToggle}
        aria-label={toggleLabel}
        title={toggleLabel}
        aria-expanded={isHelpVisible}
      >
        {shouldShowRightChevron ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
        <span className="app-header-toggle-text">{toggleLabel}</span>
      </button>
    </header>
  )
}