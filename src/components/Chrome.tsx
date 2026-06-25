import { SoundVisualizer } from './SoundVisualizer'
import { Logo } from './Logo'

interface ChromeProps {
  sectionLabel?: string
  year?: string
  soundOn?: boolean
  onToggleSound?: () => void
  onOpenMenu?: () => void
}

export function Chrome({
  sectionLabel = 'INDEX',
  year = '2026',
  soundOn = true,
  onToggleSound,
  onOpenMenu,
}: ChromeProps) {
  return (
    <>
      {/* Top center — logo opens menu */}
      <div
        className="fixed top-7 left-1/2 -translate-x-1/2"
        style={{ zIndex: 'var(--z-menu-btn)' }}
      >
        <Logo onOpenMenu={() => onOpenMenu?.()} />
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

      {/* Top right — scroll hint */}
      <div
        className="fixed top-10 right-6 pointer-events-none"
        style={{ zIndex: 'var(--z-chrome)' }}
      >
        <div className="w-6 h-6 border border-white/40 rounded-full flex items-center justify-center">
          <div className="w-0.5 h-2 bg-white/60 rounded-full" />
        </div>
      </div>

      {/* Bottom left — meta */}
      <div
        className="fixed bottom-6 left-6 pointer-events-none"
        style={{ zIndex: 'var(--z-chrome)' }}
      >
        <span className="text-white/40 text-[10px] font-mono tracking-[0.3em] uppercase">
          {year} · Istanbul
        </span>
      </div>

      {/* Bottom right — section/year */}
      <div
        className="fixed bottom-6 right-6 pointer-events-none"
        style={{ zIndex: 'var(--z-chrome)' }}
      >
        <span
          className="text-white text-2xl tracking-wider"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {sectionLabel}
        </span>
      </div>
    </>
  )
}
