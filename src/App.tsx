import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Chrome } from './components/Chrome'
import { Loader, type LoaderDestination } from './components/Loader'
import { Menu } from './components/Menu'
import { useGrainOverlay } from './hooks/useGrainOverlay'
import { MotionPage } from './pages/MotionPage'

const loadHome = () => import('./pages/HomePage')
const HomePage = lazy(() => loadHome().then((m) => ({ default: m.HomePage })))
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage })),
)

function shouldSkipLoader(pathname: string): boolean {
  const p = pathname.replace(/\/$/, '') || '/'
  return p === '/motion' || p === '/about'
}

function PageFallback() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <span className="text-white/35 font-mono text-[10px] tracking-[0.45em] uppercase animate-pulse">
        Loading
      </span>
    </div>
  )
}

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const [entered, setEntered] = useState(() => shouldSkipLoader(window.location.pathname))
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    loadHome()
  }, [])

  function handleEnter(destination: LoaderDestination) {
    setEntered(true)
    navigate(destination, { replace: true })
  }

  const showGate = !entered && !shouldSkipLoader(location.pathname)

  return (
    <>
      {!showGate && (
        <>
          <Menu open={menuOpen} onClose={() => setMenuOpen(false)} />
          <Chrome year="2026" onOpenMenu={() => setMenuOpen(true)} />
        </>
      )}

      <main className="relative min-h-svh w-full" style={{ zIndex: 'var(--z-canvas)' }}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/motion" element={<MotionPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </Suspense>
      </main>

      {showGate && <Loader onEnter={handleEnter} />}
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
