import { useEffect, useRef } from 'react'
import { useLangue } from './i18n'

// Fenêtre de confirmation stylisée, bâtie sur <dialog>.
// Pourquoi <dialog> + showModal() plutôt qu'une <div> par-dessus la page : le
// navigateur fournit le fond assombri (::backdrop), la fermeture par Échap,
// le reste de la page rendu inerte et le focus gardé dans la fenêtre.
export default function Confirmation({ ouvert, titre, message, libelleConfirmer, onConfirmer, onAnnuler }) {
  const { t } = useLangue()
  // useRef : poignée vers l'élément HTML réel, pour appeler ses méthodes
  // (showModal, close) que React ne pilote pas lui-même.
  const ref = useRef(null)
  const refAnnuler = useRef(null)

  // L'état React (ouvert) commande ; le dialog suit.
  useEffect(() => {
    const dialog = ref.current
    if (ouvert && !dialog.open) {
      dialog.showModal()
      // Focus sur Annuler : un Entrée réflexe ne détruit rien.
      refAnnuler.current.focus()
    }
    if (!ouvert && dialog.open) dialog.close()
  }, [ouvert])

  return (
    <dialog
      ref={ref}
      className="confirmation"
      aria-labelledby="confirmation-titre"
      aria-describedby="confirmation-message"
      // Échap : le navigateur ferme le dialog de lui-même ; on l'empêche pour
      // que ce soit l'état React qui décide (sinon les deux divergent).
      onCancel={(e) => {
        e.preventDefault()
        onAnnuler()
      }}
      // Clic sur le fond assombri : la cible est le <dialog> lui-même (le
      // contenu est dans .confirmation-corps), donc on annule.
      onClick={(e) => e.target === e.currentTarget && onAnnuler()}
    >
      <div className="confirmation-corps">
        <h2 className="confirmation-titre" id="confirmation-titre">{titre}</h2>
        <p className="confirmation-message" id="confirmation-message">{message}</p>
        <div className="confirmation-actions">
          <button ref={refAnnuler} className="btn btn-fantome" onClick={onAnnuler}>
            {t('btn.annuler')}
          </button>
          <button className="btn btn-danger" onClick={onConfirmer}>
            {libelleConfirmer}
          </button>
        </div>
      </div>
    </dialog>
  )
}
