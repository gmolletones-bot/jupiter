import iconUrl from '../../../../build/icon.svg'

interface JupiterLogoProps {
  className?: string
}

/** Jupiter's app icon (the same SVG the installers' icons are generated from). */
function JupiterLogo({ className = '' }: JupiterLogoProps): React.JSX.Element {
  return (
    <img className={`jupiter-logo ${className}`} src={iconUrl} alt="Jupiter" draggable={false} />
  )
}

export default JupiterLogo
