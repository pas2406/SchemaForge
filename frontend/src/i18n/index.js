// Traduction légère, sans bibliothèque : un fichier JSON par langue et une
// fonction t('clé', { paramètres }) partagée via un contexte React.
// Pourquoi un contexte : la langue est lue par presque tous les composants ;
// la passer de parent en enfant (props) alourdirait chaque signature.
import { createContext, useContext } from 'react'
import fr from './fr.json'
import en from './en.json'

const DICTIONNAIRES = { fr, en }
export const LANGUES = ['fr', 'en']
export const CLE_STOCKAGE = 'langue'

// Langue au premier chargement : le choix mémorisé, sinon celle du navigateur
// si on la propose, sinon l'anglais.
export function langueInitiale() {
  try {
    const memorisee = localStorage.getItem(CLE_STOCKAGE)
    if (LANGUES.includes(memorisee)) return memorisee
  } catch {
    /* stockage indisponible (navigation privée…) : on se rabat sur le navigateur */
  }
  const navigateur = (navigator.languages?.[0] || navigator.language || '').slice(0, 2).toLowerCase()
  return LANGUES.includes(navigateur) ? navigateur : 'en'
}

// Une valeur est soit une chaîne, soit { one, other } pour les pluriels.
// Intl.PluralRules connaît les règles de chaque langue (en français, 0 et 1
// sont au singulier ; en anglais, seul 1 l'est).
export function traduire(lang, cle, params = {}) {
  let valeur = DICTIONNAIRES[lang][cle] ?? DICTIONNAIRES.en[cle]
  if (valeur === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] clé manquante : ${cle}`)
    return cle
  }
  if (typeof valeur === 'object') {
    valeur = valeur[new Intl.PluralRules(lang).select(params.n ?? 0)] ?? valeur.other
  }
  return valeur.replace(/\{(\w+)\}/g, (tout, nom) => (nom in params ? String(params[nom]) : tout))
}

// Contexte partagé ; le composant fournisseur est dans FournisseurLangue.jsx
// (un fichier .jsx ne doit exporter que des composants, pour le rechargement à chaud).
export const ContexteLangue = createContext(null)

export const useLangue = () => useContext(ContexteLangue)
