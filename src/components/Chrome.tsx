import { SoundVisualizer } from './SoundVisualizer'
import { Logo } from './Logo'
import { BrandTicker } from './BrandTicker'

interface ChromeProps {
  year?: string
  soundOn?: boolean
  onToggleSound?: () => void
  onOpenMenu?: () => void
}

export function Chrome({
  year = '2026',
  soundOn = true,
  onToggleSound,
  onOpenMenu,
}: ChromeProps) {
  return (
    <>
      {/* Top center — logo → home / universe */}
      <div
        className="fixed top-7 left-1/2 -translate-x-1/2"
        style={{ zIndex: 'var(--z-menu-btn)' }}
      >
        <Logo />
      </div>

      {/* Top left — sound */}
      <div
        className="fixed top-10 left-6 flex items-center gap-3"
        style={{ zIndex: 'var(--z-chrome)' }}
      >
        <button
          type="button"
          onClick={onToggleSound}
          className="flex items-center w-[72px] justify-end focus:outline-none"
          aria-label={soundOn ? 'Mute ambient' : 'Unmute ambient'}
        >
          <SoundVisualizer active={soundOn} />
        </button>
      </div>

      {/* Top right — menu */}
      <div className="fixed top-10 right-6" style={{ zIndex: 'var(--z-chrome)' }}>
        <button
          type="button"
          onClick={() => onOpenMenu?.()}
          className="text-white/50 font-mono text-[10px] tracking-[0.35em] uppercase hover:text-white transition-colors duration-200"
          aria-label="Open menu"
        >
          MENU
        </button>
      </div>

      {/* Bottom left — meta (above brand ticker) */}
      <div
        className="fixed bottom-9 sm:bottom-10 left-4 sm:left-6 pointer-events-none"
        style={{ zIndex: 'var(--z-chrome)' }}
      >
        <span className="text-white/40 text-[8px] sm:text-[10px] font-mono tracking-[0.12em] sm:tracking-[0.18em]">
          {year} Represented by MMG ARTISTS
        </span>
      </div>

      <BrandTicker />
    </>
  )
}
