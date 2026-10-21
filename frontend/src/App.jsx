import { useState, useEffect, useMemo, useRef } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { linter, lintGutter, setDiagnostics } from '@codemirror/lint'
import { planTheme } from './sqlTheme'
import { preparerIssues, grouperParTable, messageIssue, libelleIssue, SEVERITES } from './rules'
import { parseSchema, localiser } from './schema'
import { preparerCorrection } from './correction'
import { IconeSeverite, Logotype, IllustrationValide, IconeCorbeille, IconeEtincelles, IconeCoche } from './Dessins'
import { illuminer, surbrillance } from './surbrillance'
import { useLangue, LANGUES } from './i18n'
import Diagramme from './Diagramme'
import Generer from './Generer'
import Fond from './Fond'
import './App.css'

const API = 'http://localhost:8000'

const EXEMPLE = `CREATE TABLE users (
  id INT,
  email TEXT
);

CREATE TABLE logs (
  user_id INT,
  message TEXT
);`

// Extensions de l'éditeur, définies UNE fois hors du composant.
// Pourquoi : @uiw/react-codemirror reconfigure l'éditeur dès que l'identité du
// tableau change ; recréé à chaque rendu (ex. à chaque survol), il effaçait les
// soulignements. linter(null) déclare l'état du linter dans la config (sans
// source de lint : c'est l'API qui fournit les diagnostics), pour qu'il survive
// à toute reconfiguration.
const EXTENSIONS = [sql(), linter(null), lintGutter(), surbrillance]
const BASIC_SETUP = { lineNumbers: true, foldGutter: false, highlightActiveLine: true }

// Détecte macOS pour afficher le bon raccourci (⌘ ou Ctrl).
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// Éléments porteurs de texte traduit : ils seuls font un fondu quand la
// langue change (l'éditeur et le diagramme, eux, ne changent pas).
const TEXTES_TRADUITS = '.marque-tag, .nav-lien, .onglet, .planche-tete, .etat-texte, .etat-valide, .banniere-erreur, .filtres, .groupe'

// Erreur affichable : une clé de traduction (+ paramètres), ou un texte brut
// venu du backend (ex. « DDL invalide : … »), qu'on ne sait pas traduire.
function erreurDepuis(e) {
  if (e.message === 'Failed to fetch') return { cle: 'erreur.api', params: { url: API } }
  if (e.status && !e.detail) return { cle: 'erreur.http', params: { status: e.status } }
  return { brut: e.detail || e.message }
}

// fetch + JSON, avec une erreur exploitable (statut, détail du backend) si échec.
async function appelerApi(chemin, corps) {
  const r = await fetch(`${API}${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  if (!r.ok) {
    const d = await r.json().catch(() => null)
    throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status, detail: typeof d?.detail === 'string' ? d.detail : null })
  }
  return r.json()
}

// Ligne (1-based) d'un offset dans le texte : pour « voir ligne N » dans la liste.
const ligneDe = (texte, offset) => texte.slice(0, offset).split('\n').length

function App() {
  const [ddl, setDdl] = useState(EXEMPLE)
  const [ddlAnalyse, setDdlAnalyse] = useState('') // texte tel qu'il était au moment de l'analyse
  const [problemes, setProblemes] = useState(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState(null) // { cle, params } ou { brut }
  const [fixes, setFixes] = useState({}) // index d'issue -> { loading | data + correction | err }
  const { lang, setLang, t } = useLangue()
  const vueRef = useRef(null) // instance CodeMirror (EditorView), pour y poser les diagnostics
  const [numAnalyse, setNumAnalyse] = useState(0) // change à chaque analyse -> rejoue les animations
  const [balayage, setBalayage] = useState(0)     // change à chaque lancement -> rejoue le balayage
  // Survol partagé entre la liste, l'éditeur et le diagramme :
  // { issue } quand on survole un problème, { table } quand on survole une table du diagramme.
  const [survol, setSurvol] = useState(null)
  // Écran affiché : 'analyser' (DDL -> problèmes) ou 'generer' (texte -> DDL).
  // Un simple état suffit : deux écrans ne justifient pas un routeur.
  const [onglet, setOnglet] = useState('analyser')

  // Changement de langue : seuls les textes changent, avec un fondu de 150 ms.
  // Web Animations API (element.animate) plutôt qu'une classe CSS : rejouer une
  // animation CSS impose de retirer puis remettre la classe ; ici, un appel suffit.
  // Pas d'animation au premier rendu (la langue n'a pas « changé »).
  const premiereLangue = useRef(lang)
  useEffect(() => {
    if (lang === premiereLangue.current) return
    premiereLangue.current = null // désormais, chaque changement anime
    for (const el of document.querySelectorAll(TEXTES_TRADUITS)) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' })
    }
  }, [lang])

  // Issues enrichies (identifiant SFxxx, colonnes, doublons fusionnés) + positions dans le texte.
  const issues = useMemo(() => {
    if (!problemes) return null
    return preparerIssues(problemes).map((p) => {
      const plages = p.tables.flatMap((t) => localiser(ddlAnalyse, t, p.colonnes))
      return { ...p, plages, ligne: plages[0] ? ligneDe(ddlAnalyse, plages[0].from) : null }
    })
  }, [problemes, ddlAnalyse])

  // Pousse les problèmes dans l'éditeur (gouttière + soulignement + infobulle).
  // Pourquoi setDiagnostics plutôt qu'un linter() CodeMirror : l'analyse vient
  // de l'API, à la demande ; on injecte simplement son résultat. CodeMirror
  // recale ensuite tout seul les marqueurs si l'utilisateur modifie le texte.
  useEffect(() => {
    const vue = vueRef.current
    if (!vue) return
    const texte = vue.state.doc.toString()
    const diagnostics = (issues || []).flatMap((p) =>
      p.tables
        .flatMap((t) => localiser(texte, t, p.colonnes))
        .map(({ from, to }) => ({
          from,
          to,
          severity: p.meta.severite,
          source: p.meta.id,
          message: messageIssue(p, t),
        })),
    )
    vue.dispatch(setDiagnostics(vue.state, diagnostics))
  }, [issues, t]) // t change avec la langue -> infobulles retraduites, sans nouvelle analyse

  // Survol -> illumine les lignes concernées dans l'éditeur.
  useEffect(() => {
    const vue = vueRef.current
    if (!vue) return
    const texte = vue.state.doc.toString()
    let positions = []
    if (survol?.issue) {
      positions = survol.issue.tables.flatMap((t) => localiser(texte, t, survol.issue.colonnes)).map((r) => r.from)
    } else if (survol?.table) {
      positions = localiser(texte, survol.table).map((r) => r.from)
    }
    vue.dispatch({ effects: illuminer.of(positions) })
  }, [survol])

  // Ce que le diagramme doit mettre en évidence (tables + colonnes, en minuscules).
  const focusDiagramme = useMemo(() => {
    if (survol?.issue) {
      const { tables, colonnes } = survol.issue
      return {
        tables: new Set(tables.map((t) => t.toLowerCase())),
        colonnes: new Set(tables.flatMap((t) => colonnes.map((c) => `${t}.${c}`.toLowerCase()))),
      }
    }
    if (survol?.table) return { tables: new Set([survol.table.toLowerCase()]), colonnes: new Set() }
    return null
  }, [survol])

  // texte : par défaut le contenu de l'éditeur ; « Appliquer la correction »
  // passe le DDL corrigé directement (l'état ddl n'est pas encore à jour).
  async function analyser(texte = ddl) {
    if (chargement) return
    setChargement(true)
    setBalayage((n) => n + 1)
    setErreur(null)
    setFixes({}) // nouvelle analyse -> on oublie les corrections précédentes
    try {
      const data = await appelerApi('/analyze', { ddl: texte })
      setDdlAnalyse(texte)
      setProblemes(data)
      setNumAnalyse((n) => n + 1)
      setSurvol(null)
    } catch (e) {
      setProblemes(null)
      setErreur(erreurDepuis(e))
    } finally {
      setChargement(false)
    }
  }

  // Ctrl+Entrée (⌘+Entrée sur Mac) lance l'analyse, où que soit le focus.
  // Écoute en phase de CAPTURE : on intercepte la touche avant CodeMirror,
  // dont le raccourci par défaut Mod-Enter insère une ligne vide.
  // Ctrl+Entrée ne lance l'analyse que sur l'onglet Analyser (sur Générer,
  // l'écran d'analyse est caché : rien ne doit s'y déclencher en douce).
  const analyserRef = useRef(analyser)
  useEffect(() => {
    analyserRef.current = onglet === 'analyser' ? analyser : () => {} // toujours la version à jour
  })
  useEffect(() => {
    const surTouche = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        e.stopPropagation()
        analyserRef.current()
      }
    }
    window.addEventListener('keydown', surTouche, true)
    return () => window.removeEventListener('keydown', surTouche, true)
  }, [])

  // Demande une correction au LLM pour UNE seule issue (à la demande),
  // rédigée dans la langue de l'interface.
  async function suggererIssue(p) {
    setFixes((f) => ({ ...f, [p.i]: { loading: true } }))
    try {
      const data = await appelerApi('/suggest-issue', {
        ddl: ddlAnalyse,
        rule: p.rule,
        table: p.table,
        message: p.message, // message d'origine du backend (le LLM lit le français)
        lang,
      })
      // Diff limité aux tables visées + DDL complet prêt à appliquer (ou null).
      const correction = preparerCorrection(ddlAnalyse, data.ddl_corrige, p.tables)
      setFixes((f) => ({ ...f, [p.i]: { data, correction } }))
    } catch (e) {
      const err = erreurDepuis(e)
      setFixes((f) => ({ ...f, [p.i]: { err: err.cle === 'erreur.api' ? { cle: 'erreur.apiCourt' } : err } }))
    }
  }

  // Appliquer : remplace le texte de l'éditeur puis relance l'analyse.
  function appliquer(nouveauDdl) {
    setDdl(nouveauDdl)
    analyser(nouveauDdl)
  }

  // Place le curseur sur le problème dans l'éditeur et l'y fait défiler.
  function voirDansEditeur(p) {
    const vue = vueRef.current
    if (!vue) return
    const plage = p.tables.flatMap((t) => localiser(vue.state.doc.toString(), t, p.colonnes))[0]
    if (!plage) return
    vue.dispatch({ selection: { anchor: plage.from, head: plage.to }, scrollIntoView: true })
    vue.focus()
  }

  function vider() {
    setDdl('')
    setProblemes(null)
    setErreur(null)
    setFixes({})
  }

  const structure = useMemo(() => parseSchema(ddl), [ddl])

  return (
    <>
    {/* Fond HORS de .app : .app crée son propre empilement (z-index 1) ;
        à l'intérieur, le calque fixe passerait par-dessus le contenu. */}
    <Fond />
    <div className="app">
      <header className="entete">
        <div className="marque">
          <Logotype />
          <span className="marque-tag">{t('entete.tag')}</span>
        </div>
        {/* Onglets : même pilule segmentée que le choix de langue */}
        <div className="onglets" role="group" aria-label={t('onglet.choix')}>
          {['analyser', 'generer'].map((o) => (
            <button key={o} className="onglet" aria-pressed={onglet === o} onClick={() => setOnglet(o)}>
              {t(`onglet.${o}`)}
            </button>
          ))}
        </div>
        <nav className="nav">
          <a className="nav-lien" href={`${API}/docs`} target="_blank" rel="noreferrer">{t('entete.docApi')}</a>
          {/* Sélecteur segmenté : deux boutons à bascule (aria-pressed) */}
          <div className="langues" role="group" aria-label={t('langue.choix')}>
            {LANGUES.map((l) => (
              <button
                key={l}
                className="langue"
                lang={l}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Les deux écrans restent montés ; hidden masque l'inactif. Pourquoi :
          démonter l'analyse ferait perdre l'éditeur et ses soulignements,
          démonter la génération ferait perdre le DDL généré (un appel LLM). */}
      <main className="grille" hidden={onglet !== 'analyser'}>
        <div className="colonne colonne-principale">
          <section className="planche" aria-labelledby="titre-schema">
            <div className="planche-tete">
              <h2 className="planche-titre" id="titre-schema">{t('schema.titre')}</h2>
              <div className="actions">
                <button className="btn btn-effacer" onClick={vider}>
                  <IconeCorbeille />
                  {t('btn.effacer')}
                </button>
                <button className="btn btn-fantome" onClick={() => setDdl(EXEMPLE)}>{t('btn.exemple')}</button>
                <button className="btn btn-principal" onClick={() => analyser()} disabled={chargement}>
                  {chargement ? t('btn.analyseEnCours') : t('btn.analyser')}
                  <kbd className="raccourci">{MAC ? '⌘' : 'Ctrl'}+{t('raccourci.entree')}</kbd>
                </button>
              </div>
            </div>
            <div className="editeur">
              {/* Ligne de balayage : remontée (key) à chaque analyse, une seule passe */}
              {balayage > 0 && <div className="balayage" key={balayage} aria-hidden="true" />}
              <CodeMirror
                value={ddl}
                onChange={setDdl}
                onCreateEditor={(vue) => (vueRef.current = vue)}
                theme={planTheme}
                extensions={EXTENSIONS}
                minHeight="300px"
                maxHeight="520px"
                aria-label={t('schema.editeur')}
                basicSetup={BASIC_SETUP}
              />
            </div>
          </section>

          <section className="planche" aria-labelledby="titre-diagramme">
            <div className="planche-tete">
              <h2 className="planche-titre" id="titre-diagramme">{t('diagramme.titre')}</h2>
              <div className="legende" aria-hidden="true">
                <span><svg viewBox="0 0 24 6"><line x1="0" y1="3" x2="24" y2="3" className="lg-fk" /></svg>{t('diagramme.legendeFk')}</span>
                <span><svg viewBox="0 0 24 6"><line x1="0" y1="3" x2="24" y2="3" className="lg-suspect" /></svg>{t('diagramme.legendeSuspect')}</span>
              </div>
            </div>
            <Diagramme
              key={numAnalyse}
              tables={structure}
              focus={focusDiagramme}
              onSurvolTable={(nom) => setSurvol(nom ? { table: nom } : null)}
            />
          </section>
        </div>

        <aside className="colonne colonne-laterale" aria-labelledby="titre-problemes">
          <section className="planche">
            <PanneauResultats
              key={numAnalyse}
              survol={survol}
              onSurvol={setSurvol}
              erreur={erreur}
              chargement={chargement}
              issues={issues}
              fixes={fixes}
              onSuggerer={suggererIssue}
              onAppliquer={appliquer}
              onVoir={voirDansEditeur}
            />
          </section>
        </aside>
      </main>
      <Generer api={API} hidden={onglet !== 'generer'} />
    </div>
    </>
  )
}

function PanneauResultats({ erreur, chargement, issues, fixes, onSuggerer, onAppliquer, onVoir, survol, onSurvol }) {
  const { t } = useLangue()
  // Filtre d'affichage local : quelles gravités sont masquées. Les hooks doivent
  // s'exécuter à chaque rendu -> déclaré AVANT les retours anticipés ci-dessous.
  const [masquees, setMasquees] = useState(() => new Set())
  const basculer = (sev) =>
    setMasquees((m) => {
      const n = new Set(m)
      if (n.has(sev)) n.delete(sev)
      else n.add(sev)
      return n
    })
  // Texte d'une erreur : clé traduite, ou texte brut du backend.
  const texteErreur = (e) => (e.cle ? t(e.cle, e.params) : e.brut)

  const titre = (texte) => (
    <div className="planche-tete">
      <h2 className="planche-titre" id="titre-problemes">{texte}</h2>
    </div>
  )

  if (erreur) {
    return (
      <>
        {titre(t('problemes.titre'))}
        <div className="banniere-erreur" role="alert">
          <IconeSeverite severite="error" />
          <div>
            <p className="be-titre">{t('erreur.titre')}</p>
            <p className="be-msg">{texteErreur(erreur)}</p>
          </div>
        </div>
      </>
    )
  }

  if (chargement && issues === null) {
    return (
      <>
        {titre(t('problemes.titre'))}
        <p className="etat-texte" aria-live="polite">{t('etat.chargement')}</p>
      </>
    )
  }

  if (issues === null) {
    return (
      <>
        {titre(t('problemes.titre'))}
        <p className="etat-texte">{t('etat.initial')}</p>
      </>
    )
  }

  if (issues.length === 0) {
    return (
      <>
        {titre(t('problemes.titre'))}
        <div className="etat-valide">
          <IllustrationValide />
          <p className="ev-titre">{t('etat.valideTitre')}</p>
          <p className="etat-texte">{t('etat.valideTexte')}</p>
        </div>
      </>
    )
  }

  const compte = { error: 0, warning: 0, info: 0 }
  for (const p of issues) compte[p.meta.severite]++
  const visibles = issues.filter((p) => !masquees.has(p.meta.severite))
  const groupes = grouperParTable(visibles)
  const rangs = new Map(groupes.flatMap((g) => g.issues).map((p, k) => [p.i, k]))

  return (
    <>
      {titre(t('problemes.compte', { n: issues.length }))}

      {/* Chaque compteur est un interrupteur : cliquer masque/affiche cette gravité. */}
      <div className="filtres" role="group" aria-label={t('filtre.aria')}>
        {SEVERITES.filter((s) => compte[s] > 0).map((s) => (
          <button
            key={s}
            className={`filtre filtre-${s}`}
            onClick={() => basculer(s)}
            aria-pressed={!masquees.has(s)}
          >
            <IconeSeverite severite={s} />
            {t(`severite.compte.${s}`, { n: compte[s] })}
          </button>
        ))}
      </div>

      {visibles.length === 0 && <p className="etat-texte">{t('filtre.toutMasque')}</p>}

      {groupes.map((g, ig) => (
        <section className="groupe" key={g.table} style={{ '--rang': ig }}>
          <h3 className="groupe-titre">
            <span className="ident">{g.table}</span>
            <span className="groupe-compte">{g.issues.length}</span>
          </h3>
          <ul className="issues">
            {g.issues.map((p) => {
              const fix = fixes[p.i]
              // Survol d'une table du diagramme : ses problèmes ressortent, les autres s'estompent.
              const etat = survol?.table
                ? p.tables.some((tb) => tb.toLowerCase() === survol.table.toLowerCase()) ? 'issue-focus' : 'issue-attenue'
                : survol?.issue?.i === p.i ? 'issue-focus' : ''
              // Rang global (ordre d'affichage) -> décalage de la cascade d'apparition.
              const rang = rangs.get(p.i)
              return (
                <li
                  className={`issue issue-${p.meta.severite} ${etat}`}
                  key={p.i}
                  style={{ '--rang': rang }}
                  onPointerEnter={() => onSurvol({ issue: p })}
                  onPointerLeave={() => onSurvol(null)}
                  onFocus={() => onSurvol({ issue: p })}
                  onBlur={() => onSurvol(null)}
                >
                  <div className="issue-tete">
                    <IconeSeverite severite={p.meta.severite} />
                    <span className={`issue-id tampon tampon-${p.meta.severite}`}>{p.meta.id}</span>
                    <span className="issue-label">{libelleIssue(p, t)}</span>
                    {p.ligne && (
                      <button className="lien" onClick={() => onVoir(p)}>{t('issue.ligne', { n: p.ligne })}</button>
                    )}
                  </div>
                  <p className="issue-msg">{messageIssue(p, t)}</p>
                  {p.colonnes.length > 0 && (
                    <p className="issue-loc">
                      {t('issue.colonnes', { n: p.colonnes.length })}{' '}
                      {p.colonnes.map((c) => <code className="ident" key={c}>{c}</code>)}
                    </p>
                  )}

                  <div className="issue-fix">
                    {!fix && (
                      <button className="btn-pilule" onClick={() => onSuggerer(p)}>
                        <IconeEtincelles />
                        {t('fix.proposer')}
                      </button>
                    )}
                    {fix?.loading && <span className="fix-attente" aria-live="polite">{t('fix.attente')}</span>}
                    {fix?.err && <span className="fix-err" role="alert">{texteErreur(fix.err)}</span>}
                    {fix?.data && <CarteCorrection fix={fix} onAppliquer={onAppliquer} />}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}

// Correction proposée : explication du LLM, diff de la table concernée, bouton Appliquer.
function CarteCorrection({ fix, onAppliquer }) {
  const { t } = useLangue()
  const { data, correction } = fix
  return (
    <div className="fix">
      <p className="fix-tete">{t('fix.titre')}</p>
      <p className="fix-correction">{data.correction}</p>
      <p className="fix-just">{data.justification}</p>
      {correction ? (
        <>
          {correction.blocs.map((b) => (
            // <ins> / <del> : la nature de chaque ligne est portée par la balise
            // elle-même (lue par les lecteurs d'écran), pas seulement par la couleur.
            <pre className="diff" key={b.table} aria-label={t('fix.diff')}>
              {b.lignes.map((l, k) => {
                const Balise = l.type === '+' ? 'ins' : l.type === '-' ? 'del' : 'span'
                return (
                  <Balise key={k} className="diff-ligne" title={l.type === '+' ? t('fix.ajout') : l.type === '-' ? t('fix.retrait') : undefined}>
                    <span className="diff-marge" aria-hidden="true">{l.type === '=' ? ' ' : l.type === '+' ? '+' : '−'}</span>
                    {l.texte}
                  </Balise>
                )
              })}
            </pre>
          ))}
          <button className="btn btn-appliquer" onClick={() => onAppliquer(correction.ddl)}>
            <IconeCoche />
            {t('fix.appliquer')}
          </button>
        </>
      ) : (
        <>
          <p className="fix-note">{t('fix.brut')}</p>
          <pre className="fix-ddl">{data.ddl_corrige}</pre>
        </>
      )}
    </div>
  )
}

export default App
