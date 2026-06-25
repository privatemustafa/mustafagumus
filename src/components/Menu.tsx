import { MENU_ITEMS } from '../data/types'

interface MenuProps {
  open: boolean
  onClose: () => void
}

export function Menu({ open, onClose }: MenuProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 bg-black/95"
      style={{ zIndex: 'var(--z-loader)' }}
      role="dialog"
      aria-label="Navigation menu"
    >
      <nav className="flex flex-col items-center gap-7 pt-[50px]">
        {MENU_ITEMS.map((item, i) => (
          <div
            key={item.href}
            className="menu-fade-in"
            style={{ animationDelay: `${0.05 + i * 0.1}s` }}
          >
            <a
              href={item.href}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noopener noreferrer' : undefined}
              onClick={onClose}
              className="block opacity-65 transition-opacity duration-200 hover:opacity-100 cursor-pointer"
            >
              <span
                className="text-white text-4xl sm:text-5xl tracking-widest"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {item.label}
              </span>
            </a>
          </div>
        ))}

        <div
          className="flex flex-col gap-6 mt-12 items-center menu-fade-in"
          style={{ animationDelay: '0.5s' }}
        >
          <span className="text-white/40 text-[10px] font-mono tracking-widest">
            ©2026 MUSTAFA GUMUS
          </span>
          <a
            href="https://instagram.com/mustafagumus______"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/65 text-sm font-mono tracking-widest hover:opacity-100 opacity-65 transition-opacity duration-200 underline"
          >
            @mustafagumus______
          </a>
        </div>
      </nav>
    </div>
  )
}
