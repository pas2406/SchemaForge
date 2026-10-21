import { useEffect, useState } from 'react'
import { useLangue } from './i18n'
import { parseSchema } from './schema'

// Nombre d'analyses demandées à GET /history (le back plafonne à 200).
const LIMITE = 50

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

  // Intl formate la date selon la langue choisie (22 oct. 2026, 00:31 / Oct 22, 2026, 12:31 AM).
  const formatDate = new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <main className="grille grille-simple">
      <section className="planche" aria-labelledby="titre-historique">
        <div className="planche-tete">
          <h2 className="planche-titre" id="titre-historique">{t('historique.titre')}</h2>
          {analyses && (
            <span className="compte-tables">{t('historique.compte', { n: analyses.length })}</span>
          )}
        </div>

        {erreur && <div className="banniere-erreur">{erreur.brut ?? t(erreur.cle, erreur.params)}</div>}
        {!erreur && chargement && <p className="etat-texte">{t('historique.chargement')}</p>}
        {!erreur && analyses?.length === 0 && <p className="etat-texte">{t('historique.vide')}</p>}

        {!erreur && analyses?.length > 0 && (
          <ul className="historique">
            {analyses.map((a) => (
              <li key={a.id}>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
