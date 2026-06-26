import { Logo } from './Logo'
import { BrandTicker } from './BrandTicker'

interface ChromeProps {
  year?: string
  onOpenMenu?: () => void
}

export function Chrome({ year = '2026', onOpenMenu }: ChromeProps) {
  return (
    <>
      {/* Top center — name opens menu */}
      <div
        className="fixed top-6 sm:top-7 left-1/2 -translate-x-1/2 max-w-[min(92vw,360px)]"
        style={{ zIndex: 'var(--z-menu-btn)' }}
      >
        <Logo onOpenMenu={onOpenMenu} />
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
