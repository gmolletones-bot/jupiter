import { useState } from 'react'
import { ACCENT_COLORS, compressImage, WALLPAPERS } from '../appearance'
import type { Settings, StoredWallpaper, WallpaperRef } from '../types'
import BrowserPreview from './BrowserPreview'
import Segmented from './Segmented'
import Switch from './Switch'
import Wallpaper from './Wallpaper'
import { Check, ImagePlus, Moon, Sparkles, Sun, X } from 'lucide-react'

interface PersonalizationSectionProps {
  settings: Settings
  wallpapers: StoredWallpaper[]
  onChange: (patch: Partial<Settings>) => void
  onWallpapersChange: (wallpapers: StoredWallpaper[]) => void
}

const THEMES: { value: BrowserTheme; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' }
]

function PersonalizationSection({
  settings,
  wallpapers,
  onChange,
  onWallpapersChange
}: PersonalizationSectionProps): React.JSX.Element {
  const [uploadError, setUploadError] = useState('')
  const [slot, setSlot] = useState<'day' | 'night'>('day')
  const slotKey = slot === 'day' ? 'wallpaper' : 'nightWallpaper'
  const selected = settings[slotKey]
  const choose = (wallpaper: WallpaperRef): void =>
    onChange(slot === 'day' ? { wallpaper } : { nightWallpaper: wallpaper })
  const isCustomAccent = !ACCENT_COLORS.some((color) => color.value === settings.accentColor)

  const uploadWallpaper = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadError('')
    try {
      const image = { id: crypto.randomUUID(), dataUrl: await compressImage(file) }
      onWallpapersChange([...wallpapers, image])
      choose(`img:${image.id}`)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'No se pudo cargar la imagen.')
    }
  }

  const removeWallpaper = (id: string): void => {
    onWallpapersChange(wallpapers.filter((image) => image.id !== id))
    const ref = `img:${id}`
    onChange({
      ...(settings.wallpaper === ref ? { wallpaper: 'aurora' } : {}),
      ...(settings.nightWallpaper === ref ? { nightWallpaper: '' } : {})
    })
  }

  const thumbClass = (wallpaper: WallpaperRef): string =>
    selected === wallpaper ? 'wallpaper-thumb selected' : 'wallpaper-thumb'

  return (
    <>
      <section className="hero-card">
        <div className="hero-glow" />
        <div className="hero-text">
          <span className="hero-badge">
            <Sparkles /> Personalización
          </span>
          <h1>Haz que este navegador sea tuyo</h1>
          <p>
            Colores, fondos animados, formas y más. Todo cambia al instante: mira la vista previa.
          </p>
        </div>
        <BrowserPreview settings={settings} wallpapers={wallpapers} />
      </section>

      <section className="settings-card">
        <h2>Tema</h2>
        <div className="theme-cards">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              className={settings.theme === theme.value ? 'theme-card selected' : 'theme-card'}
              onClick={() => onChange({ theme: theme.value })}
            >
              <span className={`theme-art theme-art-${theme.value}`}>
                <i />
                <i />
                <i />
              </span>
              <span className="theme-name">{theme.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2>Color de acento</h2>
        <div className="swatches">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              className={settings.accentColor === color.value ? 'swatch selected' : 'swatch'}
              style={{ '--swatch': color.value } as React.CSSProperties}
              title={color.name}
              onClick={() => onChange({ accentColor: color.value })}
            >
              {settings.accentColor === color.value && <Check className="swatch-check" />}
            </button>
          ))}
          <label
            className={isCustomAccent ? 'swatch swatch-custom selected' : 'swatch swatch-custom'}
            style={
              isCustomAccent
                ? ({ '--swatch': settings.accentColor } as React.CSSProperties)
                : undefined
            }
            title="Elegir otro color"
          >
            {isCustomAccent && <Check className="swatch-check" />}
            <input
              type="color"
              value={settings.accentColor}
              onChange={(event) => onChange({ accentColor: event.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2>Fondo de la página de inicio</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">
              {slot === 'day' ? 'Fondo de día' : 'Fondo de noche'}
            </div>
            <div className="settings-hint">
              De 19:00 a 7:00 se usa el fondo de noche. Sube tus imágenes a la galería.
            </div>
          </div>
          <Segmented
            value={slot}
            options={[
              {
                value: 'day',
                label: (
                  <>
                    <Sun /> Día
                  </>
                )
              },
              {
                value: 'night',
                label: (
                  <>
                    <Moon /> Noche
                  </>
                )
              }
            ]}
            onChange={setSlot}
          />
        </div>
        <div className="wallpaper-grid">
          {slot === 'night' && (
            <button className={thumbClass('')} onClick={() => choose('')}>
              <Wallpaper wallpaper={settings.wallpaper} images={wallpapers} />
              <span className="wallpaper-name">Igual que de día</span>
            </button>
          )}

          {WALLPAPERS.map((wallpaper) => (
            <button
              key={wallpaper.id}
              className={thumbClass(wallpaper.id)}
              onClick={() => choose(wallpaper.id)}
            >
              <Wallpaper wallpaper={wallpaper.id} images={[]} sounds={['waves', 'wind']} />
              <span className="wallpaper-name">{wallpaper.name}</span>
            </button>
          ))}

          {wallpapers.map((image, index) => (
            <button
              key={image.id}
              className={thumbClass(`img:${image.id}`)}
              onClick={() => choose(`img:${image.id}`)}
            >
              <Wallpaper wallpaper={`img:${image.id}`} images={wallpapers} />
              <span className="wallpaper-name">Imagen {index + 1}</span>
              <span
                className="wallpaper-remove"
                role="button"
                title="Quitar de la galería"
                onClick={(event) => {
                  event.stopPropagation()
                  removeWallpaper(image.id)
                }}
              >
                <X />
              </span>
            </button>
          ))}

          <label className="wallpaper-thumb wallpaper-upload">
            <input type="file" accept="image/*" onChange={uploadWallpaper} />
            <ImagePlus className="upload-icon" />
            <span className="wallpaper-name">Subir imagen</span>
          </label>
        </div>
        {uploadError && <p className="settings-error">{uploadError}</p>}
      </section>

      <section className="settings-card">
        <h2>Interfaz</h2>
        <div className="settings-row">
          <div>
            <div className="settings-label">Teñir la barra de pestañas</div>
            <div className="settings-hint">Usa tu color de acento en la parte superior.</div>
          </div>
          <Switch
            label="Teñir la barra de pestañas"
            checked={settings.tintTabBar}
            onChange={(tintTabBar) => onChange({ tintTabBar })}
          />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Barra de marcadores</div>
            <div className="settings-hint">Tus sitios guardados bajo la barra de direcciones.</div>
          </div>
          <Switch
            label="Barra de marcadores"
            checked={settings.showBookmarksBar}
            onChange={(showBookmarksBar) => onChange({ showBookmarksBar })}
          />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Animaciones</div>
            <div className="settings-hint">Fondos animados y transiciones suaves.</div>
          </div>
          <Switch
            label="Animaciones"
            checked={settings.animations}
            onChange={(animations) => onChange({ animations })}
          />
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-label">Redondez de las esquinas</div>
            <div className="settings-hint">De recto y sobrio a suave y redondeado.</div>
          </div>
          <div className="range">
            <input
              type="range"
              min={0}
              max={20}
              value={settings.cornerRadius}
              onChange={(event) => onChange({ cornerRadius: Number(event.target.value) })}
            />
            <span className="range-value">{settings.cornerRadius}px</span>
          </div>
        </div>
      </section>
    </>
  )
}

export default PersonalizationSection
