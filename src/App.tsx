import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Chrome } from './components/Chrome'
import { Loader } from './components/Loader'
import { Menu } from './components/Menu'
import { useGrainOverlay } from './hooks/useGrainOverlay'

// Lazy-load the heavy three.js universe so the loader paints instantly.
const loadHome = () => import('./pages/HomePage')
const HomePage = lazy(() => loadHome().then((m) => ({ default: m.HomePage })))
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })),
)

function AppContent() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [soundOn, setSoundOn] = useState(true)

  // Warm the universe chunk in the background while the loader is on screen.
  useEffect(() => {
    loadHome()
  }, [])

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
            <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
              </Routes>
            </Suspense>
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
