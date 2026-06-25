import type { CollageImage } from '../data/types'

interface CollageProps {
  images: CollageImage[]
  onImageClick?: (img: CollageImage) => void
}

export function Collage({ images, onImageClick }: CollageProps) {
  return (
    <div className="relative w-full min-h-[200vh]">
      {images.map((img) => (
        <button
          key={img.id}
          type="button"
          onClick={() => onImageClick?.(img)}
          className="absolute cursor-pointer transition-opacity duration-300 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          style={{
            left: `${img.x}%`,
            top: `${img.y}%`,
            width: `${img.width}%`,
            opacity: img.opacity ?? 0.85,
            transform: `rotate(${img.rotation ?? 0}deg)`,
            zIndex: Math.round((img.opacity ?? 0.85) * 10),
          }}
          aria-label={`Photo ${img.id}`}
        >
          <img
            src={img.src}
            alt=""
            className="w-full h-auto shadow-2xl"
            loading="lazy"
            draggable={false}
          />
        </button>
      ))}
    </div>
  )
}
