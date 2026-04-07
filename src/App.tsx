import { useState, useCallback, useRef, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import './App.css'
import { AppSidebar } from './components/AppSidebar'
import { AppHeader } from './components/AppHeader'
import BudgetScanner from './pages/BudgetScanner/BudgetScanner'
import { BudgetScannerHelp } from './pages/BudgetScanner/Help'

const MIN_SIDEBAR_WIDTH = 10 // %
const MAX_SIDEBAR_WIDTH = 90 // %

export default function App() {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(50) // % of container
  const [isEffectivelySidebarCollapsed, setIsEffectivelySidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  )
  const isDraggingRef = useRef(false)
  const sidebarWidthRef = useRef(50)

  // Update ref when state changes
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only allow drag on desktop (not mobile)
    if (window.matchMedia('(max-width: 768px)').matches) return
    isDraggingRef.current = true
    e.preventDefault()
  }, [])

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return

    const container = document.querySelector('.app-shell') as HTMLElement
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const newWidth = e.clientX - containerRect.left
    const newWidthPercent = (newWidth / containerRect.width) * 100

    // Clamp between min and max
    const clampedWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidthPercent))

    // Auto-collapse if width drops below 10%
    if (clampedWidth <= MIN_SIDEBAR_WIDTH) {
      setIsEffectivelySidebarCollapsed(true)
      setSidebarWidth(MIN_SIDEBAR_WIDTH)
    } else {
      setIsEffectivelySidebarCollapsed(false)
      setSidebarWidth(clampedWidth)
    }
  }, [])

  // Persistent listeners for mousemove and mouseup
  useEffect(() => {
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [handleDragMove, handleDragEnd])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    setIsMobile(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  const desktopCollapsed = isCollapsed || isEffectivelySidebarCollapsed
  const effectiveIsCollapsed = isMobile ? false : desktopCollapsed

  return (
    <div className={`app-shell ${effectiveIsCollapsed ? 'sidebar-collapsed' : 'sidebar-open'} ${isMobileSidebarOpen ? 'mobile-sidebar-open' : ''}`} style={{
      '--sidebar-width': `${sidebarWidth}%`
    } as React.CSSProperties & { '--sidebar-width': string }}>
      <AppSidebar isCollapsed={effectiveIsCollapsed} />
      {!isMobile && !effectiveIsCollapsed && (
        <div
          className="app-divider"
          onMouseDown={handleDragStart}
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(sidebarWidth)}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
        />
      )}
      <div className="app-content">
        <AppHeader
          isCollapsed={desktopCollapsed}
          setIsCollapsed={setIsCollapsed}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<BudgetScanner />} />
            <Route path="/help" element={<BudgetScannerHelp />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
