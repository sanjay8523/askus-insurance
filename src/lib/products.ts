import car from '../assets/img/car.svg'
import bike from '../assets/img/bike.svg'
import auto from '../assets/img/auto.svg'
import commercial from '../assets/img/commercial.svg'
import health from '../assets/img/health.svg'
import term from '../assets/img/term.svg'

export type Product = {
  iconName: string
  image: string
  id: string
  name: string
  tag: string
  group: string
  color: string
  startingAt?: number
  /** Partner journey opened inside the iframe (set in .env.local) */
  journeyUrl?: string
}

const env = import.meta.env

export const PRODUCTS: Product[] = [
  { id: 'car', iconName: 'car-front', image: car, name: 'Car Insurance', tag: 'Protect your drive', group: 'Motor Insurance', color: '#69849c', startingAt: 2094, journeyUrl: env.VITE_PARTNER_URL_CAR },
  { id: 'bike', iconName: 'bike', image: bike, name: 'Bike Insurance', tag: 'Ride with confidence', group: 'Motor Insurance', color: '#62a885', startingAt: 538, journeyUrl: env.VITE_PARTNER_URL_BIKE },
  { id: 'auto', iconName: 'car-taxi-front', image: auto, name: 'Auto Insurance', tag: 'Auto-rickshaw cover', group: 'Motor Insurance', color: '#b58932', startingAt: 2400, journeyUrl: env.VITE_PARTNER_URL_COMMERCIAL },
  { id: 'commercial', iconName: 'truck', image: commercial, name: 'Commercial Vehicle Insurance', tag: 'Cover your business vehicle', group: 'Motor Insurance', color: '#69849c', startingAt: 3000, journeyUrl: env.VITE_PARTNER_URL_COMMERCIAL },
  { id: 'health', iconName: 'heart-pulse', image: health, name: 'Health Insurance', tag: 'Medical protection', group: 'Health Insurance', color: '#d76279', journeyUrl: env.VITE_PARTNER_URL_HEALTH },
  { id: 'term', iconName: 'shield-check', image: term, name: 'Term Insurance', tag: 'Life cover', group: 'Term Insurance', color: '#8c65cf', journeyUrl: env.VITE_PARTNER_URL_TERM },
]

export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export const HELPLINE = '7358447586'
