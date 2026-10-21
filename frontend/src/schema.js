// Lecture LÉGÈRE du DDL côté front, uniquement pour l'affichage (diagramme,
// positions des problèmes dans l'éditeur). Best-effort (regex) : n'affecte pas
// l'analyse réelle, faite par le backend avec sqlglot.

const RE_TABLE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi

export function decouperColonnes(corps) {
  // Découpe sur les virgules de premier niveau (en ignorant celles dans des parenthèses).
  const parts = []
  let profondeur = 0
  let courant = ''
  for (const ch of corps) {
    if (ch === '(') profondeur++
    else if (ch === ')') profondeur--
    if (ch === ',' && profondeur === 0) {
      parts.push(courant)
      courant = ''
    } else {
      courant += ch
    }
  }
  if (courant.trim()) parts.push(courant)
  return parts
}

export function parseSchema(ddl) {
  const tables = []
  let m
  RE_TABLE.lastIndex = 0
  while ((m = RE_TABLE.exec(ddl))) {
    const colonnes = []
    const pkTable = new Set() // PRIMARY KEY (a, b) déclarée en contrainte de table
    const fkTable = new Map() // FOREIGN KEY (col) REFERENCES t(...)
    for (const brut of decouperColonnes(m[2])) {
      const seg = brut.trim()
      if (!seg) continue
      const pk = seg.match(/^(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]*)\)/i)
      if (pk) pk[1].split(',').forEach((c) => pkTable.add(c.trim().replace(/["`]/g, '')))
      const fk = seg.match(/^(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(\s*["`]?(\w+)["`]?\s*\)\s*REFERENCES\s+["`]?(\w+)["`]?\s*(?:\(\s*["`]?(\w+))?/i)
      if (fk) fkTable.set(fk[1], { table: fk[2], colonne: fk[3] || null })
      // Les lignes de contraintes de table ne sont pas des colonnes.
      if (/^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|CHECK)\b/i.test(seg)) continue
      const def = seg.match(/^["`]?(\w+)["`]?\s+([\w]+(?:\s*\([^)]*\))?(?:\[\])?)?/)
      if (!def) continue
      // REFERENCES table(colonne) : la colonne visée sert à ancrer le lien du diagramme.
      const ref = seg.match(/REFERENCES\s+["`]?(\w+)["`]?\s*(?:\(\s*["`]?(\w+))?/i)
      colonnes.push({
        nom: def[1],
        type: (def[2] || '').toUpperCase(),
        ref: ref?.[1] || null,
        refCol: ref?.[2] || null,
        pk: /PRIMARY\s+KEY/i.test(seg),
      })
    }
    for (const c of colonnes) {
      if (pkTable.has(c.nom)) c.pk = true
      if (fkTable.has(c.nom)) {
        c.ref = fkTable.get(c.nom).table
        c.refCol = fkTable.get(c.nom).colonne
      }
    }
    tables.push({ nom: m[1], colonnes })
  }
  return tables
}

// Relations « suspectées » : colonnes *_id sans FK déclarée. On devine la table
// cible (client_id -> client / clients) ; null si aucune table ne correspond.
export function cibleSuspectee(colonne, tables) {
  const base = colonne.replace(/_id$/i, '').toLowerCase()
  const candidats = [base, `${base}s`, `${base}es`, base.replace(/y$/, 'ies')]
  return tables.find((t) => candidats.includes(t.nom.toLowerCase()))?.nom || null
}

// Positions (offsets) d'une table et de ses colonnes dans le texte du DDL.
// Pourquoi : le backend ne renvoie pas de numéro de ligne ; on retrouve donc
// l'emplacement dans le texte pour souligner directement dans l'éditeur.
export function localiser(ddl, nomTable, colonnes = []) {
  RE_TABLE.lastIndex = 0
  let m
  while ((m = RE_TABLE.exec(ddl))) {
    if (m[1].toLowerCase() !== nomTable.toLowerCase()) continue
    const debutNom = m.index + m[0].indexOf(m[1])
    const debutCorps = m.index + m[0].indexOf('(') + 1
    const corps = m[2]
    const plages = []
    for (const col of colonnes) {
      // Une colonne commence en début de corps ou juste après une virgule.
      const re = new RegExp(`(^|,)\\s*["\`]?(${col})["\`]?\\b`, 'i')
      const c = corps.match(re)
      if (c) {
        const from = debutCorps + c.index + c[0].lastIndexOf(c[2])
        plages.push({ from, to: from + c[2].length })
      }
    }
    // Problème de niveau table (ou colonne introuvable) : on vise le nom de table.
    if (plages.length === 0) plages.push({ from: debutNom, to: debutNom + m[1].length })
    return plages
  }
  return []
}
