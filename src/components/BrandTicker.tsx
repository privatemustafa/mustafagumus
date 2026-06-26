import { BRANDS, type Brand } from '../data/brands'

function BrandItem({ brand }: { brand: Brand }) {
  if (brand.logo) {
    return (
      <span className="inline-flex items-center h-4 sm:h-[18px] opacity-45">
        <img
          src={brand.logo}
          alt={brand.name}
          className="h-full w-auto max-w-[72px] sm:max-w-[88px] object-contain brightness-0 invert"
          loading="lazy"
          decoding="async"
        />
      </span>
    )
  }

  return (
    <span
      className="text-white/45 text-[9px] sm:text-[10px] font-mono tracking-[0.28em] uppercase whitespace-nowrap"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      {brand.name}
    </span>
  )
}

export function BrandTicker() {
  const loop = [...BRANDS, ...BRANDS]

  return (
    <div
      className="fixed bottom-0 left-0 right-0 pointer-events-none overflow-hidden border-t border-white/[0.06] bg-black/50"
      style={{ zIndex: 'var(--z-chrome)' }}
      aria-hidden
    >
      <div className="relative py-2 sm:py-2.5">
        <div className="absolute inset-y-0 left-0 w-10 sm:w-24 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-10 sm:w-24 bg-gradient-to-l from-black via-black/80 to-transparent z-10" />

        <div className="brand-ticker-track flex items-center gap-10 sm:gap-14 px-4">
          {loop.map((brand, i) => (
            <span key={`${brand.name}-${i}`} className="inline-flex items-center shrink-0">
              <BrandItem brand={brand} />
              <span className="ml-10 sm:ml-14 text-white/20 text-[8px] select-none">·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
