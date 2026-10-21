// Fournit { lang, setLang, t } à toute l'application (voir index.js).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CLE_STOCKAGE, ContexteLangue, langueInitiale, traduire } from './index.js'

export default function FournisseurLangue({ children }) {
  const [lang, setLang] = useState(langueInitiale)
  // useCallback : t ne change d'identité que si la langue change ; les effets
  // qui en dépendent (diagnostics de l'éditeur) ne se relancent qu'à ce moment.
  const t = useCallback((cle, params) => traduire(lang, cle, params), [lang])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = t('page.titre')
    try {
      localStorage.setItem(CLE_STOCKAGE, lang)
    } catch {
      /* choix non mémorisé, sans conséquence pour la session en cours */
    }
  }, [lang, t])

  const valeur = useMemo(() => ({ lang, setLang, t }), [lang, t])
  return <ContexteLangue.Provider value={valeur}>{children}</ContexteLangue.Provider>
}
