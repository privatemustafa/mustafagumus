import { Link } from 'react-router-dom'

interface LogoProps {
  onNavigate?: () => void
}

export function Logo({ onNavigate }: LogoProps) {
  return (
    <Link
      to="/"
      className="logo"
      onClick={() => onNavigate?.()}
      aria-label="Mustafa Gumus — home"
    >
      <span className="logo__rule" aria-hidden />
      <span className="logo__lockup">
        <span className="logo__line">MUSTAFA</span>
        <span className="logo__line">GUMUS</span>
      </span>
      <span className="logo__rule" aria-hidden />
    </Link>
  )
}
