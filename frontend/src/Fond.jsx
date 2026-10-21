// Fond de page : grille millimétrée (avec parallaxe), vignettage radial,
// grain léger, et réticule qui suit la souris (desktop uniquement).
// Pourquoi écrire directement dans element.style au lieu d'un état React :
// la souris et le défilement émettent des dizaines d'événements par seconde ;
// passer par setState re-rendrait l'application entière à chaque fois.
import { useEffect, useRef } from 'react'

// Grain : bruit fractal SVG (feTurbulence) encodé en data-URI, désaturé.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
  "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>\")"

export default function Fond() {
  const grilleRef = useRef(null)
  const reticuleRef = useRef(null)

  useEffect(() => {
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)')
    const souris = window.matchMedia('(hover: hover) and (pointer: fine)')
    let image = 0 // requestAnimationFrame en attente : au plus une mise à jour par image

    // Parallaxe : la grille défile à 30 % de la vitesse du contenu.
    const surDefilement = () => {
      if (reduit.matches || image) return
      image = requestAnimationFrame(() => {
        image = 0
        if (grilleRef.current) grilleRef.current.style.backgroundPosition = `0 ${-window.scrollY * 0.3}px`
      })
    }

    // Réticule : on déplace deux traits fins via des variables CSS.
    const surSouris = (e) => {
      const r = reticuleRef.current
      if (!r || reduit.matches || !souris.matches) return
      // Calé sur la maille de 8 px, en tenant compte du décalage de parallaxe
      // vertical : la croix tombe toujours sur une intersection de la grille.
      const decalage = (((-window.scrollY * 0.3) % 8) + 8) % 8
      const x = Math.round(e.clientX / 8) * 8
      const y = Math.round((e.clientY - decalage) / 8) * 8 + decalage
      r.style.setProperty('--mx', `${x}px`)
      r.style.setProperty('--my', `${y}px`)
      r.dataset.actif = 'oui'
    }
    const surSortie = () => {
      if (reticuleRef.current) reticuleRef.current.dataset.actif = 'non'
    }

    window.addEventListener('scroll', surDefilement, { passive: true })
    window.addEventListener('pointermove', surSouris, { passive: true })
    document.documentElement.addEventListener('pointerleave', surSortie)
    return () => {
      cancelAnimationFrame(image)
      window.removeEventListener('scroll', surDefilement)
      window.removeEventListener('pointermove', surSouris)
      document.documentElement.removeEventListener('pointerleave', surSortie)
    }
  }, [])

  return (
    <div className="fond" aria-hidden="true">
      <div className="fond-grille" ref={grilleRef} />
      <div className="fond-vignette" />
      <div className="fond-grain" style={{ backgroundImage: GRAIN }} />
      <div className="reticule" ref={reticuleRef} data-actif="non">
        <span className="reticule-h" />
        <span className="reticule-v" />
        <span className="reticule-centre" />
      </div>
    </div>
  )
}
