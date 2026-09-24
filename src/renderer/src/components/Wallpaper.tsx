import { isNight } from '../appearance'
import type { StoredWallpaper, WallpaperRef } from '../types'
import type { SoundId } from '../widgets/ambient'
import AmbientScene from './AmbientScene'

interface WallpaperProps {
  wallpaper: WallpaperRef
  images: StoredWallpaper[]
  /** Sounds playing, drawn by the "ambient" wallpaper. */
  sounds?: SoundId[]
  className?: string
}

/** Full-bleed background for the new tab page, also used for thumbnails and previews. */
function Wallpaper({
  wallpaper,
  images,
  sounds = [],
  className = ''
}: WallpaperProps): React.JSX.Element {
  if (wallpaper === 'ambient') {
    return (
      <AmbientScene
        sounds={sounds}
        night={isNight(new Date())}
        className={`wallpaper ${className}`}
      />
    )
  }
  if (wallpaper.startsWith('img:')) {
    const image = images.find((item) => `img:${item.id}` === wallpaper)
    if (image) {
      return (
        <div
          className={`wallpaper wallpaper-image ${className}`}
          style={{ backgroundImage: `url(${image.dataUrl})` }}
        />
      )
    }
  }
  // An image that was deleted falls back to the default preset.
  const preset = wallpaper.startsWith('img:') ? 'aurora' : wallpaper
  return <div className={`wallpaper wallpaper-${preset} ${className}`} />
}

export default Wallpaper
