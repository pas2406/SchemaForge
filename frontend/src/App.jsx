import { useState } from 'react'
import './App.css'

// Adresse de l'API (le back FastAPI tourne sur le port 8000).
const API = 'http://localhost:8000'

function App() {
  // Chaque useState = une variable surveillée par React (valeur + fonction pour la changer).
  const [ddl, setDdl] = useState('CREATE TABLE logs (message TEXT);')
  const [problemes, setProblemes] = useState([])
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  async function analyser() {
    setChargement(true)
    setErreur('')
    try {
      const reponse = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ddl }), // le corps JSON attendu par /analyze
      })
      if (!reponse.ok) throw new Error(`Erreur ${reponse.status}`)
      setProblemes(await reponse.json())
    } catch (e) {
      // "Failed to fetch" = le navigateur n'a joint personne (backend éteint ?).
      setErreur(
        e.message === 'Failed to fetch'
          ? "Impossible de joindre l'API. Le backend est-il lancé sur http://localhost:8000 ?"
          : e.message,
      )
    } finally {
      setChargement(false)
    }
  }

  return (
    <main className="conteneur">
      <h1>SchemaForge</h1>
      <p className="soustitre">Colle un DDL SQL et détecte ses incohérences.</p>

      <div className="carte">
        <textarea
          value={ddl}
          onChange={(e) => setDdl(e.target.value)} // met à jour l'état à chaque frappe
          rows={8}
          spellCheck={false}
        />

        <button onClick={analyser} disabled={chargement}>
          {chargement ? 'Analyse…' : 'Analyser'}
        </button>
      </div>

      {erreur && <p className="erreur">{erreur}</p>}

      {/* On n'affiche la liste que s'il y a des problèmes */}
      {problemes.length > 0 && (
        <ul className="problemes">
          {problemes.map((p, i) => (
            <li key={i}>
              <span className="regle">{p.rule}</span>
              <span className="table">{p.table}</span>
              <span className="message">{p.message}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export default App
