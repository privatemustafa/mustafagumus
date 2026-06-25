export function AboutPage() {
  return (
    <div className="fade-in-canvas min-h-screen flex items-center justify-center px-6 py-32">
      <div className="max-w-2xl">
        <h1
          className="text-white text-4xl sm:text-6xl tracking-wider mb-12"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          ABOUT
        </h1>
        <div className="space-y-6 text-white/70 font-mono text-sm leading-relaxed tracking-wide">
          <p>i make art 👁️</p>
          <p>
            Photographer & creative director based in Istanbul. Represented by{' '}
            <a
              href="https://instagram.com/mmgartists"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-[var(--color-accent)] transition-colors"
            >
              @mmgartists
            </a>
          </p>
          <p>
            <a
              href="mailto:info@mustafagumus.co"
              className="text-white hover:text-[var(--color-accent)] transition-colors"
            >
              info@mustafagumus.co
            </a>
          </p>
          <p className="pt-8">
            <a
              href="https://instagram.com/mustafagumus______"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white transition-colors tracking-widest"
            >
              @mustafagumus______
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
