// Petits dessins au trait (SVG maison, style dessin technique).
// Toutes les couleurs passent par currentColor / classes CSS -> tokens d'index.css.
import { useLangue } from './i18n'

// Sévérité lisible SANS la couleur : la forme porte l'information.
// error = carré plein (seul en vermillon), warning = triangle en contour, info = petit point.
export function IconeSeverite({ severite }) {
  const { t } = useLangue()
  return (
    <svg className={`sev sev-${severite}`} viewBox="0 0 12 12" role="img" aria-label={t(`severite.nom.${severite}`)}>
      {severite === 'error' && <rect x="1.5" y="1.5" width="9" height="9" />}
      {severite === 'warning' && <path d="M6 1.6 L10.8 10.2 H1.2 Z" />}
      {severite === 'info' && <circle cx="6" cy="6" r="2.4" />}
    </svg>
  )
}

// Logotype : pictogramme « table » au trait + nom en serif.
export function Logotype() {
  return (
    <span className="logotype">
      <svg className="logo-picto" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2.5" y="3.5" width="19" height="17" />
        <rect className="logo-tete" x="2.5" y="3.5" width="19" height="4.5" />
        <line x1="9" y1="8" x2="9" y2="20.5" />
        <line x1="2.5" y1="12.2" x2="21.5" y2="12.2" />
        <line x1="2.5" y1="16.4" x2="21.5" y2="16.4" />
      </svg>
      <span className="logo-nom">SchemaForge</span>
    </span>
  )
}

// Illustration de l'état « aucun problème » : une table cochée, au trait.
export function IllustrationValide() {
  return (
    <svg className="illu" viewBox="0 0 120 80" aria-hidden="true">
      <rect x="10" y="10" width="70" height="56" />
      <line x1="10" y1="22" x2="80" y2="22" />
      <line x1="10" y1="36" x2="80" y2="36" strokeDasharray="2 3" />
      <line x1="10" y1="50" x2="80" y2="50" strokeDasharray="2 3" />
      <line x1="34" y1="22" x2="34" y2="66" />
      {/* Cote d'architecte sous la table */}
      <line x1="10" y1="74" x2="80" y2="74" />
      <line x1="10" y1="71" x2="10" y2="77" />
      <line x1="80" y1="71" x2="80" y2="77" />
      <circle cx="96" cy="30" r="14" />
      <path className="illu-coche" d="M89 30 l5 5 l9 -10" />
    </svg>
  )
}

// Icônes d'action (décoratives : le texte du bouton porte le sens).
export function IconeCorbeille() {
  return (
    <svg className="icone" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 4.5h11M6 4.5V2.8h4v1.7M4 4.5l.7 9h6.6l.7-9M6.7 7v4.5M9.3 7v4.5" />
    </svg>
  )
}

// Étincelles : « proposer une correction » (le LLM suggère).
// Une grande étoile à 4 branches aux flancs incurvés + une petite.
export function IconeEtincelles() {
  return (
    <svg className="icone" viewBox="0 0 16 16" aria-hidden="true">
      <path className="icone-plein" d="M6.5 2c.5 3.3 1.7 4.5 5 5-3.3.5-4.5 1.7-5 5-.5-3.3-1.7-4.5-5-5 3.3-.5 4.5-1.7 5-5z" />
      <path className="icone-plein" d="M12.75 1c.22 1.45.78 2 2.25 2.25-1.47.22-2.03.78-2.25 2.25-.22-1.47-.78-2.03-2.25-2.25 1.47-.25 2.03-.8 2.25-2.25z" />
    </svg>
  )
}

// Coche dans un cercle : « appliquer la correction ».
export function IconeCoche() {
  return (
    <svg className="icone" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.4 8.2l1.8 1.8 3.4-3.6" />
    </svg>
  )
}
