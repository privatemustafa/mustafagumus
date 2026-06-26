export type Brand = {
  name: string
  /** Optional logo in /public/brands/ */
  logo?: string
}

export const BRANDS: Brand[] = [
  { name: "L'Officiel" },
  { name: 'Esquire' },
  { name: 'Converse', logo: '/brands/converse.svg' },
  { name: 'Superstep' },
  { name: 'Beşiktaş JK', logo: '/brands/besiktas.svg' },
  { name: 'Hindash Cosmetics' },
  { name: 'Pritch London' },
  { name: 'Derschutze' },
  { name: 'Private Issues' },
  { name: 'Mysa Moon' },
  { name: 'Vivienne Westwood' },
  { name: 'Rin' },
  { name: 'Order Act' },
  { name: 'EZGICINAR' },
  { name: 'Prism Lens FX' },
  { name: 'B&G' },
  { name: 'LOVE ME TOO' },
  { name: 'Lunaire Studio' },
  { name: 'Quatervois' },
  { name: 'Dior', logo: '/brands/dior.svg' },
  { name: 'DS Damat' },
  { name: 'Mandias' },
  { name: 'Diesel' },
  { name: 'Realm Of Be' },
  { name: 'Oath' },
]
