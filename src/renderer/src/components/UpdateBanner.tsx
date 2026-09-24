import { useState } from 'react'

interface UpdateBannerProps {
  status: UpdateStatus
}

/** Floating notice when a downloaded update is ready to install. */
function UpdateBanner({ status }: UpdateBannerProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState<string | null>(null)
  if (status.state !== 'downloaded' || dismissed === status.version) return null

  return (
    <div className="update-banner" role="status">
      <span>
        <strong>Jupiter {status.version}</strong> está lista para instalarse.
      </span>
      <button className="button-primary" onClick={() => window.api.installUpdate()}>
        Reiniciar
      </button>
      <button
        className="update-banner-close"
        title="Más tarde"
        onClick={() => setDismissed(status.version)}
      >
        ×
      </button>
    </div>
  )
}

export default UpdateBanner
