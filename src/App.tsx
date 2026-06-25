import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { Chrome } from './components/Chrome'
import { Loader } from './components/Loader'
import { Menu } from './components/Menu'
import { useGrainOverlay } from './hooks/useGrainOverlay'
import { HomePage } from './pages/HomePage'
import { WorkPage } from './pages/WorkPage'
import { AboutPage } from './pages/AboutPage'
import { SECTIONS } from './data/types'

function AppContent() {
  const [loaded, setLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const location = useLocation()

  const sectionLabel =
    location.pathname === '/work'
      ? 'WORK'
      : location.pathname === '/about'
        ? 'ABOUT'
        : SECTIONS[0].label

  return (
    <>
      {!loaded && <Loader onEnter={() => setLoaded(true)} />}

      {loaded && (
        <>
          <Menu open={menuOpen} onClose={() => setMenuOpen(false)} />
          <Chrome
            sectionLabel={sectionLabel}
            year="2026"
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((s) => !s)}
            onOpenMenu={() => setMenuOpen(true)}
          />

          <main className="relative" style={{ zIndex: 'var(--z-canvas)' }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/work" element={<WorkPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </main>
        </>
      )}
    </>
  )
}

export default function App() {
  useGrainOverlay()

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
