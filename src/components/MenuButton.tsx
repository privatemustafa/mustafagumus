interface MenuButtonProps {
  open: boolean
  onToggle: () => void
}

export function MenuButton({ open, onToggle }: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="fixed left-1/2 -translate-x-1/2 top-6 cursor-pointer p-2 text-white transition-colors duration-200 hover:text-[var(--color-accent)]"
      style={{ zIndex: 'var(--z-menu-btn)' }}
      aria-label={open ? 'Close menu' : 'Open menu'}
      aria-expanded={open}
    >
      <span
        className="text-xl sm:text-2xl tracking-[0.3em] uppercase"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {open ? 'CLOSE' : 'INFO'}
      </span>
    </button>
  )
}
