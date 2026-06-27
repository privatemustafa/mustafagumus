import { MenuLogoCycle } from './MenuLogoCycle'

interface LogoProps {
  onOpenMenu?: () => void
}

export function Logo({ onOpenMenu }: LogoProps) {
  return (
    <button
      type="button"
      className="logo"
      onClick={() => onOpenMenu?.()}
      aria-label="Open menu — Archive, Motion, and more"
    >
      <span className="logo__rule" aria-hidden />
      <MenuLogoCycle />
      <span className="logo__rule" aria-hidden />
    </button>
  )
}
