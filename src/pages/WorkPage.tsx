import { Collage } from '../components/Collage'
import { getCollageImages } from '../data/collage'

export function WorkPage() {
  const images = getCollageImages()

  return (
    <div className="fade-in-canvas pt-24 pb-32">
      <div className="px-6 mb-16">
        <h1
          className="text-white text-4xl sm:text-6xl tracking-wider"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          WORK
        </h1>
        <p className="text-white/50 font-mono text-xs mt-4 tracking-widest max-w-md">
          Photography · Film · Creative Direction
        </p>
      </div>
      <Collage images={images} />
    </div>
  )
}
