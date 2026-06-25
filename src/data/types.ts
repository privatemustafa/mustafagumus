export interface CollageImage {
  id: number
  src: string
  section?: string
  x?: number
  y?: number
  width?: number
  rotation?: number
  opacity?: number
}

export interface Section {
  id: string
  label: string
  year: string
}

export const SECTIONS: Section[] = [
  { id: 'beauty', label: 'BEAUTY', year: '2025' },
  { id: 'editorial', label: 'EDITORIAL', year: '2024' },
  { id: 'fashion', label: 'FASHION', year: '2024' },
  { id: 'street', label: 'STREET', year: '2026' },
  { id: 'campaign', label: 'CAMPAIGN', year: '2026' },
  { id: 'portrait', label: 'PORTRAIT', year: '2026' },
  { id: 'brand', label: 'BRAND', year: '2025' },
]

export const MENU_ITEMS = [
  { label: 'INDEX', href: '/' },
  { label: 'WORK', href: '/work' },
  { label: 'ABOUT', href: '/about' },
  { label: 'CONTACT', href: 'mailto:info@mustafagumus.co', external: true },
]
