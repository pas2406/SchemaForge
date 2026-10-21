import { useEffect, useState } from 'react'
import { useLangue } from './i18n'
import { parseSchema } from './schema'
import { IconeCorbeille } from './Dessins'
import Confirmation from './Confirmation'

// Nombre d'analyses demandées à GET /history : égal à la rétention du back
// (MAX_ANALYSES = 100 dans app/database.py), donc la liste montre TOUT ce qui
// est en base. Indispensable : « Vider » annonce analyses.length, ce nombre
// doit être celui que DELETE /history va réellement supprimer.
const LIMITE = 100

// Écran « Historique » : les dernières analyses enregistrées en base.
// Contrairement aux deux autres écrans, App.jsx le MONTE à chaque ouverture de
// l'onglet (et le démonte en le quittant) : on veut une liste fraîche, qui
// inclut les analyses faites entre-temps. D'où chargement = true dès le départ.
export default function Historique({ api, onOuvrir }) {
  const { lang, t } = useLangue()
  const [analyses, setAnalyses] = useState(null)
  const [chargement, setChargement] = useState(true)
  // Erreur gardée sous forme de clé de traduction, traduite à l'affichage :
  // l'effet n'a donc pas besoin de t, et l'erreur suit un changement de langue.
  const [erreur, setErreur] = useState(null) // { cle, params } ou { brut }
  const [suppression, setSuppression] = useState(null) // id en cours de suppression, ou 'tout'
  // Ce qui attend confirmation : null (fenêtre fermée), 'tout', ou une analyse.
  // Un seul état pour les deux cas : une seule fenêtre, un message adapté.
  const [aConfirmer, setAConfirmer] = useState(null)

  useEffect(() => {
    // annule : si l'onglet est quitté avant la réponse, on l'ignore (le
    // composant est démonté, il n'y a plus d'état à mettre à jour).
    let annule = false
    fetch(`${api}/history?limit=${LIMITE}`)
      .then((r) => {
        if (!r.ok) throw Object.assign(new Error(), { status: r.status })
        return r.json()
      })
      .then((data) => !annule && setAnalyses(data))
      .catch((e) => {
        if (annule) return
        if (e.status) setErreur({ cle: 'erreur.http', params: { status: e.status } })
        else if (e.message === 'Failed to fetch') setErreur({ cle: 'erreur.api', params: { url: api } })
        else setErreur({ brut: e.message })
      })
      .finally(() => !annule && setChargement(false))
    return () => {
      annule = true
    }
  }, [api])

  // DELETE puis mise à jour LOCALE de la liste (pas de nouveau GET) : le 204
  // nous dit exactement ce qui a changé. 404 = déjà supprimée ailleurs : on la
  // retire aussi, la liste reflète alors la base.
  async function supprimer(cible) {
    setSuppression(cible)
    setErreur(null)
    try {
      const chemin = cible === 'tout' ? '/history' : `/history/${cible}`
      const r = await fetch(`${api}${chemin}`, { method: 'DELETE' })
      if (!r.ok && r.status !== 404) throw Object.assign(new Error(), { status: r.status })
      setAnalyses((liste) => (cible === 'tout' ? [] : liste.filter((a) => a.id !== cible)))
    } catch (e) {
      setErreur(e.status ? { cle: 'erreur.http', params: { status: e.status } } : { cle: 'erreur.api', params: { url: api } })
    } finally {
      setSuppression(null)
    }
  }

  // Toute suppression est irréversible : on passe d'abord par la confirmation.
  function confirmer() {
    supprimer(aConfirmer === 'tout' ? 'tout' : aConfirmer.id)
    setAConfirmer(null)
  }

  // Intl formate la date selon la langue choisie (22 oct. 2026, 00:31 / Oct 22, 2026, 12:31 AM).
  const formatDate = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <main className="grille grille-simple">
      <section className="planche" aria-labelledby="titre-historique">
        <div className="planche-tete">
          <h2 className="planche-titre" id="titre-historique">{t('historique.titre')}</h2>
          {analyses && (
            <div className="actions">
              <span className="compte-tables">{t('historique.compte', { n: analyses.length })}</span>
              {analyses.length > 0 && (
                <button className="btn btn-effacer" onClick={() => setAConfirmer('tout')} disabled={suppression !== null}>
                  <IconeCorbeille />
                  {t('historique.vider')}
                </button>
              )}
            </div>
          )}
        </div>

        {erreur && <div className="banniere-erreur">{erreur.brut ?? t(erreur.cle, erreur.params)}</div>}
        {!erreur && chargement && <p className="etat-texte">{t('historique.chargement')}</p>}
        {!erreur && analyses?.length === 0 && <p className="etat-texte">{t('historique.vide')}</p>}

        {!erreur && analyses?.length > 0 && (
          <ul className="historique">
            {analyses.map((a) => (
              <li key={a.id} className="historique-ligne">
                {/* Un bouton (et non un div cliquable) : accessible au clavier, Tab + Entrée */}
                <button className="historique-entree" onClick={() => onOuvrir(a)}>
                  <span className="historique-date">{formatDate.format(new Date(a.created_at))}</span>
                  <span className={`puce ${a.problemes.length ? 'puce-pk' : 'puce-ok'}`}>
                    {a.problemes.length
                      ? t('problemes.compte', { n: a.problemes.length })
                      : t('historique.sansProbleme')}
                  </span>
                  {/* Aperçu : les noms de tables, plus parlants que la 1re ligne du DDL */}
                  <code className="historique-apercu ident">
                    {parseSchema(a.ddl).map((tb) => tb.nom).join(', ') || a.ddl.trim().split('\n')[0]}
                  </code>
                </button>
                {/* Bouton FRÈRE, pas enfant : un <button> ne peut pas en contenir un autre */}
                <button
                  className="historique-suppr"
                  onClick={() => setAConfirmer(a)}
                  disabled={suppression !== null}
                  aria-label={t('historique.supprimer')}
                  title={t('historique.supprimer')}
                >
                  <IconeCorbeille />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Confirmation
        ouvert={aConfirmer !== null}
        titre={t(aConfirmer === 'tout' ? 'historique.confirmerTitre' : 'historique.confirmerUneTitre')}
        message={
          aConfirmer === 'tout'
            ? t('historique.confirmerVider', { n: analyses?.length ?? 0 })
            : aConfirmer && t('historique.confirmerUne', { date: formatDate.format(new Date(aConfirmer.created_at)) })
        }
        libelleConfirmer={t(aConfirmer === 'tout' ? 'historique.confirmerBtn' : 'historique.confirmerUneBtn')}
        onConfirmer={confirmer}
        onAnnuler={() => setAConfirmer(null)}
      />
    </main>
  )
}
