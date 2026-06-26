import { useState } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Chrome } from './components/Chrome'
import { Loader } from './components/Loader'
import { Menu } from './components/Menu'
import { useGrainOverlay } from './hooks/useGrainOverlay'
import { HomePage } from './pages/HomePage'
import { AboutPage } from './pages/AboutPage'

function AppContent() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)

  function handleEnter() {
    setLoaded(true)
    navigate('/', { replace: true })
  }

  return (
    <>
      {!loaded && <Loader onEnter={handleEnter} />}

      {loaded && (
        <>
          <Menu open={menuOpen} onClose={() => setMenuOpen(false)} />
          <Chrome
            year="2026"
            soundOn={soundOn}
            onToggleSound={() => setSoundOn((s) => !s)}
            onOpenMenu={() => setMenuOpen(true)}
          />

          <main className="relative" style={{ zIndex: 'var(--z-canvas)' }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
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
