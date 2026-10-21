// Thème CodeMirror « cyanotype ».
// Pourquoi des variables CSS plutôt que des couleurs en dur : toute la palette
// vit dans index.css ; l'éditeur la suit sans dupliquer les valeurs.
// Chaque catégorie syntaxique a son propre token (--syn-*), réglé AA sur --code-bg.
import { createTheme } from '@uiw/codemirror-themes'
import { tags as t } from '@lezer/highlight'

export const planTheme = createTheme({
  theme: 'dark',
  settings: {
    background: 'var(--code-bg)',
    foreground: 'var(--syn-ident)',
    caret: 'var(--cyan)',
    selection: 'var(--selection)',
    selectionMatch: 'var(--selection)',
    lineHighlight: 'var(--line-active)',
    gutterBackground: 'var(--code-bg)',
    gutterForeground: 'var(--text-muted)',
    gutterBorder: 'var(--line)',
    fontFamily: 'var(--mono)',
  },
  styles: [
    { tag: t.keyword, color: 'var(--syn-keyword)', fontWeight: '500' },
    { tag: [t.typeName, t.standard(t.name)], color: 'var(--syn-type)' },
    { tag: [t.name, t.special(t.name), t.propertyName], color: 'var(--syn-ident)' },
    { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
    { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
    { tag: [t.lineComment, t.blockComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
    {
      tag: [t.operator, t.punctuation, t.paren, t.brace, t.squareBracket],
      color: 'var(--syn-punct)',
    },
  ],
})
