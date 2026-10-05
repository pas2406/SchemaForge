// Lecture LÉGÈRE du DDL côté front, uniquement pour la vue structure (arbre).
// Best-effort (regex) : n'affecte pas l'analyse réelle, faite par le backend.

function decouperColonnes(corps) {
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
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*;/gi
  let m
  while ((m = re.exec(ddl))) {
    const colonnes = []
    for (const brut of decouperColonnes(m[2])) {
      const seg = brut.trim()
      if (!seg) continue
      // On saute les lignes de contraintes de table (pas des colonnes).
      if (/^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|CHECK)\b/i.test(seg)) continue
      const nom = seg.match(/^["`]?(\w+)["`]?/)?.[1]
      if (!nom) continue
      const ref = seg.match(/REFERENCES\s+["`]?(\w+)["`]?/i)?.[1] || null
      const pk = /PRIMARY\s+KEY/i.test(seg)
      colonnes.push({ nom, ref, pk })
    }
    tables.push({ nom: m[1], colonnes })
  }
  return tables
}
