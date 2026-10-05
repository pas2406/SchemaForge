// Thème CodeMirror aux couleurs de SchemaForge (fond sombre, mots-clés turquoise).
import { createTheme } from '@uiw/codemirror-themes'
import { tags as t } from '@lezer/highlight'

const MONO = '"JetBrains Mono", ui-monospace, monospace'

export const schemaforgeTheme = createTheme({
  theme: 'dark',
  settings: {
    background: '#12161d',
    foreground: '#e7ecf3',
    caret: '#27e0b3',
    selection: 'rgba(39, 224, 179, 0.20)',
    selectionMatch: 'rgba(39, 224, 179, 0.15)',
    lineHighlight: 'rgba(255, 255, 255, 0.03)',
    gutterBackground: '#12161d',
    gutterForeground: '#4a5566',
    gutterBorder: 'transparent',
    fontFamily: MONO,
  },
  styles: [
    { tag: t.keyword, color: '#27e0b3' },
    { tag: [t.string, t.special(t.string)], color: '#5b8cff' },
    { tag: t.number, color: '#f0a35e' },
    { tag: t.comment, color: '#5b6675', fontStyle: 'italic' },
    { tag: [t.typeName, t.typeOperator], color: '#7bd0ff' },
    { tag: t.propertyName, color: '#e7ecf3' },
    { tag: [t.operator, t.punctuation], color: '#8b97a8' },
    { tag: t.bool, color: '#f0a35e' },
  ],
})

export const schemaforgeLightTheme = createTheme({
  theme: 'light',
  settings: {
    background: '#ffffff',
    foreground: '#1a1f27',
    caret: '#12b890',
    selection: 'rgba(18, 184, 144, 0.18)',
    selectionMatch: 'rgba(18, 184, 144, 0.14)',
    lineHighlight: 'rgba(0, 0, 0, 0.03)',
    gutterBackground: '#ffffff',
    gutterForeground: '#9aa4b2',
    gutterBorder: 'transparent',
    fontFamily: MONO,
  },
  styles: [
    { tag: t.keyword, color: '#0e9576' },
    { tag: [t.string, t.special(t.string)], color: '#3b6fe0' },
    { tag: t.number, color: '#b26b00' },
    { tag: t.comment, color: '#8b97a8', fontStyle: 'italic' },
    { tag: [t.typeName, t.typeOperator], color: '#2563a8' },
    { tag: t.propertyName, color: '#1a1f27' },
    { tag: [t.operator, t.punctuation], color: '#5a6675' },
    { tag: t.bool, color: '#b26b00' },
  ],
})
