// Présentation des résultats d'analyse (le backend renvoie { rule, table, message }).
// Tout ici est de l'AFFICHAGE : la détection reste faite par le moteur Python.

// Table de correspondance règle backend -> identifiant stable + sévérité.
// Pourquoi des identifiants SFxxx : comme les codes d'un linter (ESLint, Ruff),
// ils se citent dans une doc ou une discussion sans dépendre du libellé.
// Les libellés et messages sont dans i18n/*.json, indexés par cet identifiant.
const REGLES = {
  pk_manquante: { id: 'SF001', severite: 'error' },
  fk_manquante: { id: 'SF002', severite: 'warning' },
  types_incoherents: { id: 'SF003', severite: 'error' },
  colonne_multivaluee: { id: 'SF004', severite: 'warning' },
  redondance: { id: 'SF005', severite: 'warning' },
  table_sans_contrainte: { id: 'SF006', severite: 'info' },
}

export const SEVERITES = ['error', 'warning', 'info']

export function metaRegle(rule) {
  return REGLES[rule] || { id: 'SF000', severite: 'info' }
}

// Paramètres d'un problème (colonne, type…), extraits du message français du
// backend. Pourquoi les extraire : le front reconstruit le message dans la
// langue choisie à partir de l'identifiant de règle et de ces paramètres.
// Renvoie null si le message n'a pas la forme attendue (on affichera alors le
// message brut plutôt qu'une phrase à trous).
export function parametres(rule, table, message) {
  switch (rule) {
    case 'pk_manquante':
    case 'table_sans_contrainte':
      return { table }
    case 'fk_manquante': {
      const m = message.match(/«\s*\w+\.(\w+)\s*»/)
      return m && { table, colonne: m[1] }
    }
    case 'colonne_multivaluee': {
      const m = message.match(/«\s*\w+\.(\w+)\s*» est de type tableau \((.*)\) :/)
      return m && { table, colonne: m[1], type: m[2] }
    }
    case 'redondance': {
      const m = message.match(/Les colonnes (.+?) de la table/)
      return m && { table, colonnes: m[1].split(/\s*,\s*/) }
    }
    case 'types_incoherents': {
      // « La colonne « id » a des types différents : INT dans a, TEXT dans b. »
      // Le .+? paresseux, ancré sur « dans », supporte les types à virgule (NUMERIC(10, 2)).
      const m = message.match(/colonne\s*«\s*(\w+)\s*» a des types différents : (.+)\.$/)
      if (!m) return null
      const types = [...m[2].matchAll(/(.+?) dans (\w+)(?:, |$)/g)].map((x) => ({ type: x[1], table: x[2] }))
      return types.length ? { colonne: m[1], types } : null
    }
    default:
      return null
  }
}

// Message d'un problème dans la langue courante (t = fonction de traduction).
export function messageIssue(p, t) {
  if (!p.params) return p.message
  const { id } = p.meta
  const extra = {}
  if (id === 'SF003') extra.detail = p.params.types.map((x) => t('regles.SF003.detail', x)).join(', ')
  if (id === 'SF005') extra.colonnes = p.params.colonnes.join(', ')
  return t(`regles.${id}.message`, { ...p.params, ...extra })
}

// Libellé court de la règle (titre de la carte), ou le nom brut si règle inconnue.
export const libelleIssue = (p, t) => (p.meta.id === 'SF000' ? p.rule.replace(/_/g, ' ') : t(`regles.${p.meta.id}.label`))

// Colonnes visées, pour localiser le problème dans l'éditeur et le diagramme.
function colonnesVisees(params) {
  if (!params) return []
  if (params.colonnes) return params.colonnes
  return params.colonne ? [params.colonne] : []
}

// Enrichit chaque issue brute : identifiant, sévérité, paramètres, tables et colonnes visées.
// On conserve l'index d'origine `i` : les corrections LLM y sont rattachées.
export function preparerIssues(problemes) {
  const enrichies = problemes.map((p, i) => {
    const params = parametres(p.rule, p.table, p.message)
    return {
      ...p,
      i,
      meta: metaRegle(p.rule),
      params,
      tables: p.table.split(/\s*,\s*/), // types_incoherents vise plusieurs tables
      colonnes: colonnesVisees(params),
    }
  })

  // Fusion des doublons : « pas de clé primaire » implique déjà l'absence de
  // contrainte ; afficher les deux pour la même table serait du bruit.
  const sansPk = new Set(enrichies.filter((p) => p.rule === 'pk_manquante').map((p) => p.table))
  return enrichies.filter((p) => !(p.rule === 'table_sans_contrainte' && sansPk.has(p.table)))
}

// Regroupe par table (titre de groupe), erreurs d'abord : dans chaque groupe et entre groupes.
export function grouperParTable(issues) {
  const groupes = new Map()
  for (const p of issues) {
    const cle = p.tables.join(' · ')
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle).push(p)
  }
  const rang = (p) => SEVERITES.indexOf(p.meta.severite)
  return [...groupes]
    .map(([table, liste]) => ({ table, issues: liste.sort((a, b) => rang(a) - rang(b)) }))
    .sort((a, b) => rang(a.issues[0]) - rang(b.issues[0])) // groupes avec erreur en tête
}
