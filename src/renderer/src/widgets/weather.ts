import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Thermometer,
  type LucideIcon
} from 'lucide-react'
import type { Settings, WeatherLocation } from '../types'

// Open-Meteo: free, no API key. https://open-meteo.com

export interface Weather {
  temperature: number
  code: number
  isDay: boolean
}

// WMO weather interpretation codes → Spanish description and icons (day, night).
const CODES: [number[], string, LucideIcon, LucideIcon][] = [
  [[0], 'Despejado', Sun, Moon],
  [[1], 'Mayormente despejado', CloudSun, CloudMoon],
  [[2], 'Parcialmente nublado', CloudSun, CloudMoon],
  [[3], 'Nublado', Cloud, Cloud],
  [[45, 48], 'Niebla', CloudFog, CloudFog],
  [[51, 53, 55, 56, 57], 'Llovizna', CloudDrizzle, CloudDrizzle],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Lluvia', CloudRain, CloudRain],
  [[71, 73, 75, 77, 85, 86], 'Nieve', CloudSnow, CloudSnow],
  [[95, 96, 99], 'Tormenta', CloudLightning, CloudLightning]
]

export function describeWeather(weather: Weather): { text: string; icon: LucideIcon } {
  const match = CODES.find(([codes]) => codes.includes(weather.code))
  if (!match) return { text: 'Desconocido', icon: Thermometer }
  return { text: match[1], icon: weather.isDay ? match[2] : match[3] }
}

export async function fetchWeather(
  location: WeatherLocation,
  unit: Settings['temperatureUnit']
): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: 'temperature_2m,weather_code,is_day',
    temperature_unit: unit,
    timezone: 'auto'
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`)
  const { current } = await response.json()
  return {
    temperature: Math.round(current.temperature_2m),
    code: current.weather_code,
    isDay: current.is_day === 1
  }
}

export async function searchCities(query: string): Promise<WeatherLocation[]> {
  const params = new URLSearchParams({ name: query, count: '6', language: 'es' })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`)
  const { results = [] } = await response.json()
  return results.map(
    (result: {
      name: string
      country?: string
      admin1?: string
      latitude: number
      longitude: number
    }) => ({
      name: result.name,
      country: [result.admin1, result.country].filter(Boolean).join(', '),
      latitude: result.latitude,
      longitude: result.longitude
    })
  )
}
