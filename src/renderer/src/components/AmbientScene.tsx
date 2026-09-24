import type { SoundId } from '../widgets/ambient'

interface AmbientSceneProps {
  sounds: SoundId[]
  night: boolean
  className?: string
}

// One wave period drawn twice so the strip can scroll by half its width seamlessly.
const WAVE =
  'M0 40 C150 10 250 70 400 40 C550 10 650 70 800 40 C950 10 1050 70 1200 40 C1350 10 1450 70 1600 40 V120 H0 Z'
const HILLS_BACK = 'M0 80 C200 20 400 70 600 45 C800 20 1000 75 1200 40 V120 H0 Z'
const HILLS_FRONT = 'M0 95 C250 55 450 100 700 70 C900 50 1050 90 1200 70 V120 H0 Z'

/**
 * Illustrated, animated scene built from the ambient sounds that are playing
 * (e.g. wind + waves = a breezy sea). Pure CSS/SVG: nothing to download or license.
 */
function AmbientScene({ sounds, night, className = '' }: AmbientSceneProps): React.JSX.Element {
  const has = (id: SoundId): boolean => sounds.includes(id)
  const classes = [
    'scene',
    night ? 'scene-night' : 'scene-day',
    has('rain') && 'scene-stormy',
    has('wind') && 'scene-windy',
    className
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} aria-hidden="true">
      <div className="scene-sky" />
      {night && <div className="scene-stars" />}
      <div className="scene-orb" />

      <div className="scene-clouds">
        <i />
        <i />
        <i />
      </div>

      {has('wind') && (
        <div className="scene-wind">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      )}

      {has('waves') ? (
        <div className="scene-sea">
          {[0, 1, 2].map((layer) => (
            <svg
              key={layer}
              className={`scene-wave scene-wave-${layer}`}
              viewBox="0 0 1600 120"
              preserveAspectRatio="none"
            >
              <path d={WAVE} />
            </svg>
          ))}
        </div>
      ) : (
        <div className="scene-land">
          <svg
            className="scene-hills scene-hills-back"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path d={HILLS_BACK} />
          </svg>
          <svg
            className="scene-hills scene-hills-front"
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
          >
            <path d={HILLS_FRONT} />
          </svg>
        </div>
      )}

      {has('fire') && (
        <div className="scene-fire">
          <div className="scene-fire-glow" />
          <div className="scene-flames">
            <i />
            <i />
            <i />
          </div>
          <div className="scene-logs">
            <i />
            <i />
          </div>
          <div className="scene-embers">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      )}

      {has('rain') && <div className="scene-rain" />}
      {has('brown') && <div className="scene-warm" />}
      {has('white') && <div className="scene-grain" />}
    </div>
  )
}

export default AmbientScene
