// Métadonnées d'affichage des règles (le backend renvoie un identifiant "rule").
// Purement présentation : ne change pas la logique de détection.

export const SEVERITE = {
  error: { label: 'ERROR', code: 'error', couleur: 'var(--error)' },
  warning: { label: 'WARNING', code: 'warn', couleur: 'var(--warning)' },
  info: { label: 'INFO', code: 'info', couleur: 'var(--info)' },
}

const REGLES = {
  pk_manquante: { id: 'PK-001', label: 'PRIMARY KEY', severite: 'error' },
  types_incoherents: { id: 'TY-002', label: 'TYPE MISMATCH', severite: 'error' },
  fk_manquante: { id: 'FK-003', label: 'FOREIGN KEY', severite: 'warning' },
  colonne_multivaluee: { id: 'NF-004', label: '1NF / ARRAY', severite: 'warning' },
  redondance: { id: 'RD-005', label: 'REDUNDANCY', severite: 'warning' },
  table_sans_contrainte: { id: 'CN-006', label: 'CONSTRAINT', severite: 'info' },
}

export function metaRegle(rule) {
  return (
    REGLES[rule] || {
      id: 'GEN-000',
      label: rule.toUpperCase().replace(/_/g, ' '),
      severite: 'info',
    }
  )
}

// Best-effort : extrait un nom de colonne d'un message du type "table.colonne".
export function colonneDepuisMessage(message) {
  return message.match(/\b\w+\.(\w+)\b/)?.[1] || null
}
