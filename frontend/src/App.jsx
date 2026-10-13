import { useState, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { schemaforgeTheme, schemaforgeLightTheme } from './sqlTheme'
import { metaRegle, colonneDepuisMessage, SEVERITE } from './rules'
import { parseSchema } from './schema'
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

// Marque géométrique (nœuds reliés → schéma relationnel), pas un emoji.
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 24 24" aria-hidden="true">
      <line x1="12" y1="4" x2="5" y2="12" />
      <line x1="12" y1="4" x2="19" y2="12" />
      <line x1="5" y1="12" x2="12" y2="20" />
      <line x1="19" y1="12" x2="12" y2="20" />
      <circle cx="12" cy="4" r="2" className="node-on" />
      <circle cx="5" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="12" cy="20" r="2" />
    </svg>
  )
}

function App() {
  const [ddl, setDdl] = useState(EXEMPLE)
  const [problemes, setProblemes] = useState(null)
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  const [fixes, setFixes] = useState({}) // index d'issue -> { loading | data | err }
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  async function analyser() {
    setChargement(true)
    setErreur('')
    setFixes({}) // nouvelle analyse -> on oublie les corrections précédentes
    try {
      const r = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ddl }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.detail || `Erreur ${r.status}`)
      }
      setProblemes(await r.json())
    } catch (e) {
      setErreur(
        e.message === 'Failed to fetch'
          ? "Impossible de joindre l'API (backend sur http://localhost:8000 ?)."
          : e.message,
      )
    } finally {
      setChargement(false)
    }
  }

  // Demande une correction au LLM pour UNE seule issue (à la demande).
  async function suggererIssue(i, p) {
    setFixes((f) => ({ ...f, [i]: { loading: true } }))
    try {
      const r = await fetch(`${API}/suggest-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ddl, rule: p.rule, table: p.table, message: p.message }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.detail || `Erreur ${r.status}`)
      }
      const data = await r.json()
      setFixes((f) => ({ ...f, [i]: { data } }))
    } catch (e) {
      setFixes((f) => ({
        ...f,
        [i]: { err: e.message === 'Failed to fetch' ? 'API injoignable.' : e.message },
      }))
    }
  }

  function vider() {
    setDdl('')
    setProblemes(null)
    setErreur('')
    setFixes({})
  }

  const structure = parseSchema(ddl)

  return (
    <div className="app">
      <header className="entete">
        <div className="marque">
          <Logo />
          <span className="marque-nom">Schema<span className="marque-accent">Forge</span></span>
          <span className="marque-tag">SQL schema linter</span>
        </div>
        <nav className="nav">
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/docs" target="_blank" rel="noreferrer">API</a>
          <button
            className="bascule-theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </nav>
      </header>

      <main className="grille">
        {/* Colonne gauche (sticky) : éditeur + structure */}
        <div className="colonne colonne-gauche">
          <section className="pane pane-editeur">
            <div className="pane-tete">
              <span className="pane-titre">
                <span className="point" /> schema.sql
              </span>
              <div className="actions">
                <button className="btn btn-ghost" onClick={() => setDdl(EXEMPLE)}>Example</button>
                <button className="btn btn-ghost" onClick={vider}>Clear</button>
                <button className="btn btn-primary" onClick={analyser} disabled={chargement}>
                  {chargement ? 'Analyzing…' : 'Analyze'}
                </button>
              </div>
            </div>
            <CodeMirror
              value={ddl}
              onChange={setDdl}
              theme={theme === 'dark' ? schemaforgeTheme : schemaforgeLightTheme}
              extensions={[sql()]}
              height="340px"
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
            />
          </section>

          {structure.length > 0 && (
            <section className="pane">
              <div className="pane-tete">
                <span className="pane-titre">
                  <span className="point" /> structure
                </span>
                <span className="compteur">{structure.length} table{structure.length > 1 ? 's' : ''}</span>
              </div>
              <div className="tree">
                {structure.map((t) => (
                  <div className="tree-table" key={t.nom}>
                    <div className="tree-nom">{t.nom}</div>
                    {t.colonnes.map((c, i) => (
                      <div className="tree-col" key={c.nom}>
                        <span className="tree-branche">
                          {i === t.colonnes.length - 1 ? '└─' : '├─'}
                        </span>
                        <span className="tree-colnom">{c.nom}</span>
                        {c.pk && <span className="chip chip-pk">PK</span>}
                        {c.ref && <span className="chip chip-fk">→ {c.ref}</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Colonne droite : diagnostics */}
        <div className="colonne">
          <section className="pane pane-resultats">
            <PanneauResultats
              erreur={erreur}
              chargement={chargement}
              problemes={problemes}
              fixes={fixes}
              onSuggererIssue={suggererIssue}
            />
          </section>
        </div>
      </main>
    </div>
  )
}

function PanneauResultats({ erreur, chargement, problemes, fixes, onSuggererIssue }) {
  if (erreur) {
    return (
      <div className="banniere-erreur">
        <div className="be-titre">ANALYSIS FAILED</div>
        <p className="be-msg">{erreur}</p>
      </div>
    )
  }

  if (chargement && problemes === null) {
    return <div className="etat-vide"><p className="ev-tag">Analyzing schema…</p></div>
  }

  if (problemes === null) {
    return (
      <div className="etat-vide">
        <div className="ev-titre">SCHEMAFORGE</div>
        <p className="ev-texte">Turn your SQL schema into actionable diagnostics.</p>
        <p className="ev-indice">Paste your DDL and press <span className="kbd">Analyze</span>.</p>
      </div>
    )
  }

  if (problemes.length === 0) {
    return (
      <div className="etat-vide">
        <div className="ev-titre">NO ISSUES FOUND</div>
        <p className="ev-texte">Your schema passed all deterministic checks.</p>
      </div>
    )
  }

  const compte = { error: 0, warning: 0, info: 0 }
  for (const p of problemes) compte[metaRegle(p.rule).severite]++

  return (
    <>
      <div className="resultats-tete">
        <span className="rt-nombre">{problemes.length}</span> issue{problemes.length > 1 ? 's' : ''}
        <span className="rt-repartition">
          {compte.error > 0 && <span style={{ color: 'var(--error)' }}>{compte.error} error{compte.error > 1 ? 's' : ''}</span>}
          {compte.warning > 0 && <span style={{ color: 'var(--warning)' }}>{compte.warning} warning{compte.warning > 1 ? 's' : ''}</span>}
          {compte.info > 0 && <span style={{ color: 'var(--info)' }}>{compte.info} info</span>}
        </span>
      </div>
      <div className="diagnostics">
        {problemes.map((p, i) => {
          const meta = metaRegle(p.rule)
          const sev = SEVERITE[meta.severite]
          const colonne = colonneDepuisMessage(p.message)
          const fix = fixes[i]
          return (
            <div className={`issue issue-${meta.severite}`} key={i}>
              <div className="issue-tete">
                <span className="issue-sev" style={{ color: sev.couleur }}>{sev.code}</span>
                <span className="issue-regle">{meta.label}</span>
                <span className="issue-cible">{p.table}</span>
              </div>
              <p className="issue-msg">{p.message}</p>
              <div className="issue-loc">
                <span>table <b>{p.table}</b></span>
                <span>column <b>{colonne || '—'}</b></span>
              </div>

              <div className="issue-fix">
                {!fix && (
                  <button className="lien-fix" onClick={() => onSuggererIssue(i, p)}>
                    suggest a fix →
                  </button>
                )}
                {fix?.loading && <span className="fix-loading">generating…</span>}
                {fix?.err && <span className="fix-err">{fix.err}</span>}
                {fix?.data && (
                  <div className="fix">
                    <div className="fix-tete">suggested fix</div>
                    <p className="fix-correction">{fix.data.correction}</p>
                    <pre className="fix-ddl">{fix.data.ddl_corrige}</pre>
                    <p className="fix-just">{fix.data.justification}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default App
