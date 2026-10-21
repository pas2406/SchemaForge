// Correction proposée par le LLM -> diff ciblé sur la table concernée + DDL à appliquer.
// Pourquoi ne pas afficher le DDL du LLM tel quel : il réécrit souvent tout le
// schéma sur une ligne ; l'œil doit chercher ce qui a changé. On isole la table
// visée, on la met en forme (une colonne par ligne) et on montre le delta.
import { decouperColonnes } from './schema'

// Instructions CREATE TABLE d'un texte, avec leur position.
// Parcours des parenthèses plutôt qu'une regex seule : les types comme
// NUMERIC(10, 2) en contiennent, et le DDL du LLM n'a pas toujours son « ; ».
function instructionsCreate(ddl) {
  const res = []
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(/gi
  let m
  while ((m = re.exec(ddl))) {
    let profondeur = 1
    let k = re.lastIndex
    for (; k < ddl.length && profondeur > 0; k++) {
      if (ddl[k] === '(') profondeur++
      else if (ddl[k] === ')') profondeur--
    }
    if (profondeur > 0) break // instruction tronquée : on s'arrête là
    const pointVirgule = ddl.slice(k).match(/^\s*;/)
    const fin = k + (pointVirgule ? pointVirgule[0].length : 0)
    res.push({ nom: m[1], corps: ddl.slice(re.lastIndex, k - 1), from: m.index, to: fin })
    re.lastIndex = fin
  }
  return res
}

// ALTER TABLE … ; (le LLM corrige parfois par ajout de contrainte plutôt qu'en réécrivant la table).
function instructionsAlter(ddl) {
  return [...ddl.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?["`]?(\w+)["`]?[^;]*;?/gi)].map((m) => ({
    nom: m[1],
    texte: m[0].replace(/\s+/g, ' ').replace(/\s*;?$/, ';'),
  }))
}

// Mise en forme canonique : une colonne ou contrainte par ligne, indentée.
// Les deux versions (actuelle et corrigée) passent par la même mise en forme,
// sinon le diff signalerait de simples différences d'espaces.
function formater(nom, corps) {
  const parts = decouperColonnes(corps)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return `CREATE TABLE ${nom} (\n${parts.map((p, i) => `  ${p}${i < parts.length - 1 ? ',' : ''}`).join('\n')}\n);`
}

// Diff ligne à ligne par plus longue sous-séquence commune (LCS), comme `diff`.
// Comparaison sans la virgule finale : ajouter une colonne en dernier ajoute
// une virgule à la ligne précédente, ce qui ne doit pas la marquer « modifiée ».
function diffLignes(avant, apres) {
  const cle = (l) => l.trim().replace(/,$/, '').replace(/\s+/g, ' ').toLowerCase()
  const a = avant.map(cle)
  const b = apres.map(cle)
  // L[i][j] = longueur de la LCS entre a[i..] et b[j..]
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    }
  }
  const lignes = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lignes.push({ type: '=', texte: apres[j] })
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) lignes.push({ type: '-', texte: avant[i++] })
    else lignes.push({ type: '+', texte: apres[j++] })
  }
  while (i < a.length) lignes.push({ type: '-', texte: avant[i++] })
  while (j < b.length) lignes.push({ type: '+', texte: apres[j++] })
  return lignes
}

// Renvoie { blocs, ddl } : blocs = un diff par table touchée (tables visées
// + nouvelles tables créées par la correction) ; ddl = le texte de l'éditeur
// une fois la correction appliquée. null si rien d'exploitable.
export function preparerCorrection(actuel, corrige, tablesVisees) {
  const avant = new Map(instructionsCreate(actuel).map((s) => [s.nom.toLowerCase(), s]))
  const apres = instructionsCreate(corrige)
  const alters = instructionsAlter(corrige)

  const blocs = []
  const operations = [] // remplacements dans le texte actuel : { from, to, texte }
  for (const nomVise of new Set(tablesVisees.map((t) => t.toLowerCase()))) {
    const orig = avant.get(nomVise)
    if (!orig) continue
    const nouvelle = apres.find((s) => s.nom.toLowerCase() === nomVise)
    const ajouts = alters.filter((a) => a.nom.toLowerCase() === nomVise).map((a) => a.texte)
    const texteAvant = formater(orig.nom, orig.corps)
    const texteApres = [nouvelle ? formater(orig.nom, nouvelle.corps) : texteAvant, ...ajouts].join('\n')
    if (texteApres === texteAvant) continue
    blocs.push({ table: orig.nom, lignes: diffLignes(texteAvant.split('\n'), texteApres.split('\n')) })
    operations.push({ from: orig.from, to: orig.to, texte: texteApres })
  }

  // Tables que la correction crée (ex. table dédiée pour un groupe redondant) :
  // insérées juste après la dernière table modifiée (elles la référencent souvent).
  const nouvelles = apres.filter((s) => !avant.has(s.nom.toLowerCase())).map((s) => formater(s.nom, s.corps))
  for (const texte of nouvelles) {
    blocs.push({ table: texte.match(/TABLE (\w+)/)[1], nouvelle: true, lignes: texte.split('\n').map((l) => ({ type: '+', texte: l })) })
  }
  if (blocs.length === 0) return null
  if (nouvelles.length) {
    const ici = operations.length ? Math.max(...operations.map((o) => o.to)) : actuel.trimEnd().length
    operations.push({ from: ici, to: ici, texte: `\n\n${nouvelles.join('\n\n')}` })
  }

  // Application de la fin vers le début : les positions des opérations
  // restantes, plus haut dans le texte, ne bougent pas.
  let ddl = actuel
  for (const o of operations.sort((x, y) => y.from - x.from || y.to - x.to)) {
    ddl = ddl.slice(0, o.from) + o.texte + ddl.slice(o.to)
  }
  return { blocs, ddl }
}
