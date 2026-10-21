import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { planTheme } from './sqlTheme'
import { useLangue } from './i18n'

// Extensions définies une fois hors du composant (même raison que dans App.jsx :
// un nouveau tableau à chaque rendu ferait reconfigurer l'éditeur).
const EXTENSIONS = [sql()]
const BASIC_SETUP = { lineNumbers: true, foldGutter: false, highlightActiveLine: false }

// Déclenche le téléchargement d'un texte comme fichier, sans passer par le serveur.
// Pourquoi un Blob : le DDL n'existe qu'en mémoire côté navigateur ; on lui donne
// une URL temporaire, on « clique » un lien <a download>, puis on libère l'URL
// (sinon la mémoire reste réservée tant que la page est ouverte).
function telecharger(contenu, nomFichier) {
  const blob = new Blob([contenu], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier
  a.click()
  URL.revokeObjectURL(url)
}

// Écran « langage naturel -> DDL ». hidden : l'écran reste monté quand on change
// d'onglet (App.jsx), pour ne perdre ni la description ni le résultat.
export default function Generer({ api, hidden }) {
  const { t } = useLangue()
  // null = « pas encore modifiée » : on affiche l'exemple dans la langue courante,
  // et il suit le changement de langue tant que l'utilisateur n'a rien tapé.
  const [description, setDescription] = useState(null)
  const texte = description ?? t('generer.exemple')
  const [resultat, setResultat] = useState(null) // { modele, ddl } renvoyé par /generate
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  async function generer() {
    setChargement(true)
    setErreur('')
    try {
      const r = await fetch(`${api}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: texte }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(typeof d?.detail === 'string' ? d.detail : t('erreur.http', { status: r.status }))
      }
      setResultat(await r.json())
    } catch (e) {
      setErreur(e.message === 'Failed to fetch' ? t('erreur.api', { url: api }) : e.message)
    } finally {
      setChargement(false)
    }
  }

  return (
    <main className="grille" hidden={hidden}>
      {/* Gauche : la demande en langage naturel, puis le modèle conçu par le LLM */}
      <div className="colonne">
        <section className="planche" aria-labelledby="titre-description">
          <div className="planche-tete">
            <h2 className="planche-titre" id="titre-description">{t('generer.titre')}</h2>
            <div className="actions">
              <button
                className="btn btn-principal"
                onClick={generer}
                disabled={chargement || !texte.trim()}
              >
                {chargement ? t('generer.enCours') : t('generer.btn')}
              </button>
            </div>
          </div>
          <textarea
            className="zone-texte"
            value={texte}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder={t('generer.placeholder')}
            aria-label={t('generer.titre')}
          />
        </section>

        {/* Le modèle relationnel tel que conçu par le LLM (avant rendu SQL) */}
        {resultat && (
          <section className="planche" aria-labelledby="titre-modele">
            <div className="planche-tete">
              <h2 className="planche-titre" id="titre-modele">{t('generer.modele')}</h2>
              <span className="compte-tables">
                {t('generer.tables', { n: resultat.modele.tables.length })}
              </span>
            </div>
            <div className="arbre">
              {resultat.modele.tables.map((table) => (
                <div className="arbre-table" key={table.name}>
                  <div className="arbre-nom ident">{table.name}</div>
                  {table.columns.map((c, i) => (
                    <div className="arbre-col" key={c.name}>
                      <span className="arbre-branche" aria-hidden="true">
                        {i === table.columns.length - 1 ? '└─' : '├─'}
                      </span>
                      <span className="ident">{c.name}</span>
                      <span className="arbre-type ident">{c.type}</span>
                      {c.primary_key && <span className="puce puce-pk">PK</span>}
                      {c.references && <span className="puce puce-fk">→ {c.references}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Droite : le DDL produit de façon déterministe à partir du modèle */}
      <div className="colonne">
        <section className="planche" aria-labelledby="titre-ddl">
          <div className="planche-tete">
            <h2 className="planche-titre" id="titre-ddl">{t('generer.ddl')}</h2>
            {resultat && (
              <button className="btn" onClick={() => telecharger(resultat.ddl, 'schema.sql')}>
                {t('generer.telecharger')}
              </button>
            )}
          </div>
          {erreur && <div className="banniere-erreur">{erreur}</div>}
          {!erreur && !resultat && <p className="etat-texte">{t('generer.vide')}</p>}
          {resultat && (
            <CodeMirror
              value={resultat.ddl}
              editable={false}
              theme={planTheme}
              extensions={EXTENSIONS}
              basicSetup={BASIC_SETUP}
            />
          )}
        </section>
      </div>
    </main>
  )
}
