// Extension CodeMirror : illumine des lignes de l'éditeur à la demande
// (survol d'un problème dans la liste ou d'une table dans le diagramme).
// Pourquoi un StateField : dans CodeMirror, tout ce qui s'affiche doit passer
// par l'état de l'éditeur. On envoie un « effet » (la liste des positions),
// le champ le transforme en décorations de ligne, que l'éditeur dessine.
import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'

export const illuminer = StateEffect.define() // valeur : tableau d'offsets (un par ligne visée)

const ligneIlluminee = Decoration.line({ class: 'cm-ligne-illuminee' })

const champ = StateField.define({
  create: () => Decoration.none,
  update(decos, tr) {
    decos = decos.map(tr.changes) // suit les modifications du texte
    for (const e of tr.effects) {
      if (!e.is(illuminer)) continue
      // Une décoration par ligne distincte, triées (exigence de RangeSet).
      const debuts = [...new Set(e.value.map((pos) => tr.state.doc.lineAt(pos).from))].sort((a, b) => a - b)
      decos = Decoration.set(debuts.map((d) => ligneIlluminee.range(d)))
    }
    return decos
  },
  provide: (f) => EditorView.decorations.from(f),
})

export const surbrillance = [champ]
