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

function App() {
  const [ddl, setDdl] = useState(EXEMPLE)
  const [problemes, setProblemes] = useState(null) // null = jamais analysé
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')
  // Thème : lu depuis localStorage, sombre par défaut.
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  // À chaque changement : on applique le thème sur <html> et on le mémorise.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  async function analyser() {
    setChargement(true)
    setErreur('')
    try {
      const reponse = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ddl }),
      })
      if (!reponse.ok) {
        // On récupère le message clair renvoyé par l'API (ex. "SQL invalide : ...").
        const data = await reponse.json().catch(() => null)
        throw new Error(data?.detail || `Erreur ${reponse.status}`)
      }
      setProblemes(await reponse.json())
    } catch (e) {
      setErreur(
        e.message === 'Failed to fetch'
          ? "Impossible de joindre l'API (backend lancé sur http://localhost:8000 ?)."
          : e.message,
      )
    } finally {
      setChargement(false)
    }
  }

  function vider() {
    setDdl('')
    setProblemes(null)
    setErreur('')
  }

  const structure = parseSchema(ddl)

  return (
    <div className="app">
      <header className="entete">
        <div className="marque">
          <span className="glyphe" aria-hidden="true">◇</span>
          <span className="marque-nom">Schema<span className="marque-accent">Forge</span></span>
          <span className="marque-tag">SQL schema linter</span>
        </div>
        <nav className="nav">
          <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          <a href="/docs" target="_blank" rel="noreferrer">API</a>
          <button
            className="bascule-theme"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
            aria-label="Changer de thème"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </nav>
      </header>

      <main className="grille">
        {/* Colonne gauche : éditeur SQL + structure */}
        <div className="colonne">
          <section className="pane pane-editeur">
            <div className="pane-tete">
              <span className="pane-titre">
                <span className="point" /> schema.sql
              </span>
              <div className="actions">
                <button className="btn btn-ghost" onClick={() => setDdl(EXEMPLE)}>
                  Example
                </button>
                <button className="btn btn-ghost" onClick={vider}>
                  Clear
                </button>
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
              height="380px"
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
                    <div className="tree-nom">▸ {t.nom}</div>
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
            />
          </section>
        </div>
      </main>
    </div>
  )
}

function PanneauResultats({ erreur, chargement, problemes }) {
  if (erreur) {
    return (
      <div className="banniere-erreur">
        <span className="be-sym">✕</span> {erreur}
      </div>
    )
  }

  if (chargement && problemes === null) {
    return <div className="etat-vide"><p className="ev-tag">Analyzing schema…</p></div>
  }

  if (problemes === null) {
    return (
      <div className="etat-vide">
        <div className="ev-glyphe">◇</div>
        <div className="ev-titre">SCHEMAFORGE</div>
        <p className="ev-texte">
          Turn your SQL schema into actionable diagnostics.
        </p>
        <p className="ev-indice">Paste your DDL and press <kbd>Analyze</kbd>.</p>
      </div>
    )
  }

  if (problemes.length === 0) {
    return (
      <div className="etat-vide">
        <div className="ev-glyphe ev-ok">✓</div>
        <div className="ev-titre">NO ISSUES FOUND</div>
        <p className="ev-texte">Your schema passed all deterministic checks.</p>
      </div>
    )
  }

  // Décompte par gravité pour la ligne de résumé (façon rapport de linter).
  const compte = { error: 0, warning: 0, info: 0 }
  for (const p of problemes) compte[metaRegle(p.rule).severite]++

  return (
    <>
      <div className="resultats-tete">
        <span className="rt-nombre">{problemes.length}</span> issue
        {problemes.length > 1 ? 's' : ''}
        <span className="rt-repartition">
          {compte.error > 0 && (
            <span style={{ color: 'var(--error)' }}>{compte.error} error{compte.error > 1 ? 's' : ''}</span>
          )}
          {compte.warning > 0 && (
            <span style={{ color: 'var(--warning)' }}>{compte.warning} warning{compte.warning > 1 ? 's' : ''}</span>
          )}
          {compte.info > 0 && (
            <span style={{ color: 'var(--info)' }}>{compte.info} info</span>
          )}
        </span>
      </div>
      <div className="diagnostics">
        {problemes.map((p, i) => {
          const meta = metaRegle(p.rule)
          const sev = SEVERITE[meta.severite]
          const colonne = colonneDepuisMessage(p.message)
          return (
            <div
              className={`issue issue-${meta.severite}`}
              key={i}
              style={{ animationDelay: `${i * 50}ms` }}
            >
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
            </div>
          )
        })}
      </div>
    </>
  )
}

export default App
