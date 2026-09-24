import { useEffect, useState } from 'react'
import type { Settings, WeatherLocation } from '../../types'
import { describeWeather, fetchWeather, type Weather } from '../../widgets/weather'
import { CloudSun } from 'lucide-react'

const REFRESH_MS = 30 * 60_000

interface WeatherWidgetProps {
  location: WeatherLocation | null
  unit: Settings['temperatureUnit']
  onConfigure: () => void
}

function WeatherWidget({ location, unit, onConfigure }: WeatherWidgetProps): React.JSX.Element {
  const [result, setResult] = useState<{ key: string; weather?: Weather; failed?: boolean }>({
    key: ''
  })
  const key = location ? `${location.latitude},${location.longitude},${unit}` : ''

  useEffect(() => {
    if (!location) return
    let cancelled = false
    const load = (): void => {
      fetchWeather(location, unit)
        .then((weather) => !cancelled && setResult({ key, weather }))
        .catch(() => !cancelled && setResult({ key, failed: true }))
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [location, unit, key])

  if (!location) {
    return (
      <button className="weather weather-empty" onClick={onConfigure}>
        <CloudSun /> Elige tu ciudad para ver el clima
      </button>
    )
  }

  // Ignore results that belong to a previous location or unit.
  const current = result.key === key ? result : { key }
  if (current.failed) {
    return <div className="weather weather-muted">Clima no disponible ahora mismo</div>
  }
  if (!current.weather) return <div className="weather weather-muted">Cargando el clima…</div>

  const { text, icon: Icon } = describeWeather(current.weather)
  return (
    <div className="weather" title={`${location.name}, ${location.country}`}>
      <Icon className="weather-icon" />
      <div>
        <div className="weather-temp">
          {current.weather.temperature}°{unit === 'celsius' ? 'C' : 'F'}
        </div>
        <div className="weather-text">
          {text} · {location.name}
        </div>
      </div>
    </div>
  )
}

export default WeatherWidget
