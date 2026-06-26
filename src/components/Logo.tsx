interface LogoProps {
  onOpenMenu?: () => void
}

export function Logo({ onOpenMenu }: LogoProps) {
  return (
    <button
      type="button"
      className="logo"
      onClick={() => onOpenMenu?.()}
      aria-label="Open menu"
    >
      <span className="logo__rule" aria-hidden />
      <span className="logo__lockup">
        <span className="logo__line">MUSTAFA</span>
        <span className="logo__line">GUMUS</span>
      </span>
      <span className="logo__rule" aria-hidden />
    </button>
  )
}
