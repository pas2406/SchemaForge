// Mini diagramme entité-relation en SVG maison (pas de dépendance).
// Une boîte par table ; FK déclarées en trait plein ; relations suspectées
// (colonnes *_id sans FK) en pointillés ambre, qui défilent.
// Chaque lien relie deux LIGNES de colonnes (logs.user_id -> users.id),
// pas deux en-têtes : on lit directement quelle colonne pointe vers laquelle.
// Animation : les cadres se tracent, puis les liens (durée totale < 1 s).
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { cibleSuspectee } from './schema'
import { useLangue } from './i18n'

// Géométrie, en pixels réels : le SVG est dessiné à l'échelle 1 (jamais
// étiré), pour que le texte garde la taille de celui de l'éditeur.
const TETE = 30      // hauteur du bandeau du nom de table
const LIGNE = 24     // hauteur d'une ligne de colonne
const MARGE_BAS = 6
const ECART_MIN = 72 // espace horizontal minimal entre boîtes (laisse passer les liens)
const ECART_MAX = 200
const ECART_Y = 40
const BORD = 20      // marge autour du dessin
const CAR = 8.1      // largeur d'un caractère IBM Plex Mono à 13.5 px (0.6 em)
const COLONNES_MAX = 4

// Délais du tracé : cadres de 0 à ~160 ms, liens à partir de 400 ms.
// Plafonnés pour que tout soit dessiné en moins d'une seconde, même avec 20 tables.
const delaiCadre = (k) => `${Math.min(k * 40, 160)}ms`
const delaiLien = (k) => `${400 + Math.min(k * 40, 160)}ms`

// Place les boîtes sur une grille qui remplit la largeur disponible, centrée.
// Pourquoi pas un algorithme de placement « intelligent » : pour des schémas de
// quelques tables, une grille lisible suffit et reste prévisible.
function placer(tables, dispo) {
  const plusLong = Math.max(
    10,
    ...tables.flatMap((t) => [t.nom.length + 2, ...t.colonnes.map((c) => c.nom.length + c.type.length + 7)]),
  )
  const l = Math.round(Math.min(320, Math.max(180, plusLong * CAR + 28)))
  const hauteur = (t) => TETE + Math.max(1, t.colonnes.length) * LIGNE + MARGE_BAS

  // Autant de colonnes que la largeur le permet, puis rééquilibrées :
  // 4 tables sur 3 colonnes possibles -> 2 + 2 plutôt que 3 + 1.
  const possibles = Math.max(1, Math.floor((dispo - 2 * BORD + ECART_MIN) / (l + ECART_MIN)))
  let nbCol = Math.min(tables.length, possibles, COLONNES_MAX)
  nbCol = Math.ceil(tables.length / Math.ceil(tables.length / nbCol))
  const ecart = nbCol > 1 ? Math.min(ECART_MAX, (dispo - 2 * BORD - nbCol * l) / (nbCol - 1)) : 0
  const largeurDessin = nbCol * l + (nbCol - 1) * ecart
  const W = Math.max(dispo, largeurDessin + 2 * BORD + 28) // +28 : place des liens qui contournent
  const x0 = Math.max(BORD, (W - largeurDessin) / 2)       // centrage horizontal

  const boites = {}
  let y = BORD
  for (let debut = 0; debut < tables.length; debut += nbCol) {
    const rangee = tables.slice(debut, debut + nbCol)
    rangee.forEach((t, k) => {
      boites[t.nom.toLowerCase()] = { t, x: x0 + k * (l + ecart), y, l, h: hauteur(t), rang: debut + k }
    })
    y += Math.max(...rangee.map(hauteur)) + ECART_Y
  }
  return { boites, W, H: y - ECART_Y + BORD }
}

// Ligne de la colonne visée dans la table cible : la colonne nommée dans
// REFERENCES t(col), sinon la clé primaire, sinon « id ». -1 = en-tête.
function rangCible(cible, refCol) {
  const cols = cible.t.colonnes
  const parNom = (nom) => cols.findIndex((c) => c.nom.toLowerCase() === nom.toLowerCase())
  if (refCol && parNom(refCol) >= 0) return parNom(refCol)
  const pk = cols.findIndex((c) => c.pk)
  return pk >= 0 ? pk : parNom('id')
}

const milieuLigne = (b, rang) => (rang < 0 ? b.y + TETE / 2 : b.y + TETE + rang * LIGNE + LIGNE / 2)

// Tracé orthogonal (coudé) entre la ligne source et la ligne cible.
function trace(src, rang, cible, rangC) {
  const y1 = milieuLigne(src, rang)
  const y2 = milieuLigne(cible, rangC)
  if (cible.x !== src.x) {
    const versDroite = cible.x > src.x
    const x1 = versDroite ? src.x + src.l : src.x
    const x2 = versDroite ? cible.x : cible.x + cible.l
    const mi = (x1 + x2) / 2
    return { d: `M${x1} ${y1} H${mi} V${y2} H${x2}`, x1, y1, x2, y2, fin: versDroite ? 'gauche' : 'droite' }
  }
  // Même colonne de la grille (ou auto-référence) : on contourne par la droite.
  const x1 = src.x + src.l
  const x2 = cible.x + cible.l
  return { d: `M${x1} ${y1} H${x1 + 22} V${y2} H${x2}`, x1, y1, x2, y2, fin: 'droite' }
}

// Cadre en <path> (et non <rect>) : pathLength="1" permet d'animer le tracé
// avec stroke-dasharray/dashoffset quelle que soit la taille de la boîte.
// Coins arrondis de rayon R (arcs « a »), assortis aux panneaux.
const R = 6
const cadre = (x, y, l, h) =>
  `M${x + R} ${y} H${x + l - R} a${R} ${R} 0 0 1 ${R} ${R} V${y + h - R} a${R} ${R} 0 0 1 ${-R} ${R} ` +
  `H${x + R} a${R} ${R} 0 0 1 ${-R} ${-R} V${y + R} a${R} ${R} 0 0 1 ${R} ${-R} Z`
// Bandeau du nom : arrondi en haut seulement.
const bandeau = (x, y, l) =>
  `M${x} ${y + TETE} V${y + R} a${R} ${R} 0 0 1 ${R} ${-R} H${x + l - R} a${R} ${R} 0 0 1 ${R} ${R} V${y + TETE} Z`

export default function Diagramme({ tables, focus, onSurvolTable }) {
  const { t } = useLangue()
  const prefixe = useId().replace(/:/g, '') // ids de <mask> uniques dans la page
  const zone = useRef(null)
  const [dispo, setDispo] = useState(0)

  // Largeur disponible, suivie en continu (redimensionnement de la fenêtre).
  // useLayoutEffect : mesurée AVANT le premier affichage, pas de saut visible.
  useLayoutEffect(() => {
    const el = zone.current
    const mesurer = () => setDispo(el.clientWidth)
    mesurer()
    const obs = new ResizeObserver(mesurer)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  if (tables.length === 0) {
    return (
      <div className="diagramme" ref={zone}>
        <p className="vide-discret">{t('diagramme.vide')}</p>
      </div>
    )
  }

  const { boites, W, H } = placer(tables, dispo)
  const boite = (nom) => boites[nom.toLowerCase()]
  const tableVisee = (nom) => focus?.tables.has(nom.toLowerCase())
  const colonneVisee = (table, col) => focus?.colonnes.has(`${table}.${col}`.toLowerCase())

  // Collecte des liens : déclarés (FK) et suspectés (*_id sans FK).
  const liens = []
  for (const tb of tables) {
    const src = boite(tb.nom)
    tb.colonnes.forEach((c, rang) => {
      const cle = `${tb.nom}.${c.nom}`
      if (c.ref) {
        const cible = boite(c.ref)
        if (cible) liens.push({ cle, ...trace(src, rang, cible, rangCible(cible, c.refCol)), suspect: false })
      } else if (/_id$/i.test(c.nom)) {
        const nomCible = cibleSuspectee(c.nom, tables)
        if (nomCible) {
          const cible = boite(nomCible)
          liens.push({ cle, ...trace(src, rang, cible, rangCible(cible, null)), suspect: true })
        } else {
          // Cible inconnue : amorce de lien avec un « ? ».
          const x1 = src.x + src.l
          const y1 = milieuLigne(src, rang)
          liens.push({ cle, d: `M${x1} ${y1} h22`, x1, y1, inconnu: true, suspect: true })
        }
      }
    })
  }

  return (
    <div className="diagramme" ref={zone}>
      {dispo > 0 && (
        <svg
          className="er"
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-label={t('diagramme.aria', { tables: tables.length, liens: liens.length })}
        >
          {Object.values(boites).map(({ t: tb, x, y, l, h, rang }) => (
            <g
              className={`er-table ${tableVisee(tb.nom) ? 'er-focus' : ''}`}
              key={tb.nom}
              onPointerEnter={() => onSurvolTable?.(tb.nom)}
              onPointerLeave={() => onSurvolTable?.(null)}
            >
              <rect className="er-fond" x={x} y={y} width={l} height={h} rx={R} />
              <path className="er-tete" d={bandeau(x, y, l)} />
              {tb.colonnes.map((c, k) =>
                colonneVisee(tb.nom, c.nom) ? (
                  <rect key={c.nom} className="er-ligne-focus" x={x + 1} y={y + TETE + k * LIGNE} width={l - 2} height={LIGNE} />
                ) : null,
              )}
              <path className="er-cadre trace" d={cadre(x, y, l, h)} pathLength="1" style={{ animationDelay: delaiCadre(rang) }} />
              <line className="er-sep trace" x1={x} y1={y + TETE} x2={x + l} y2={y + TETE} pathLength="1" style={{ animationDelay: delaiCadre(rang) }} />
              <g className="er-texte" style={{ animationDelay: delaiCadre(rang) }}>
                <text className="er-nom" x={x + 12} y={y + TETE / 2 + 5}>{tb.nom}</text>
                {tb.colonnes.map((c, k) => {
                  const cy = milieuLigne({ y }, k) + 4.5
                  return (
                    <g key={c.nom} className={colonneVisee(tb.nom, c.nom) ? 'er-col-focus' : ''}>
                      <text className="er-cle" x={x + 10} y={cy}>{c.pk ? 'PK' : c.ref ? 'FK' : ''}</text>
                      <text className={`er-col ${c.pk ? 'er-col-pk' : ''}`} x={x + 34} y={cy}>{c.nom}</text>
                      <text className="er-type" x={x + l - 10} y={cy} textAnchor="end">{c.type.toLowerCase()}</text>
                    </g>
                  )
                })}
              </g>
            </g>
          ))}

          {liens.map((ln, k) => {
            const delai = { animationDelay: delaiLien(k) }
            const idMasque = `${prefixe}-m${k}`
            return (
              <g className={`er-lien ${ln.suspect ? 'er-suspect' : ''}`} key={ln.cle}>
                {ln.suspect ? (
                  <>
                    {/* Pointillés qui défilent : on ne peut pas animer leur tracé avec le
                        même dasharray ; on dévoile donc le chemin à travers un masque
                        qui, lui, se trace. */}
                    <mask id={idMasque} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                      <path className="trace" d={ln.d} pathLength="1" style={delai} />
                    </mask>
                    <path className="er-pointilles" d={ln.d} mask={`url(#${idMasque})`} />
                  </>
                ) : (
                  <path className="trace" d={ln.d} pathLength="1" style={delai} />
                )}
                {/* Côté FK : petit rond ; côté cible : barre perpendiculaire (« un ») */}
                <g className="er-bouts" style={delai}>
                  <circle cx={ln.x1} cy={ln.y1} r="3" />
                  {ln.inconnu ? (
                    <text className="er-inconnu" x={ln.x1 + 27} y={ln.y1 + 5}>?</text>
                  ) : (
                    <line
                      x1={ln.fin === 'gauche' ? ln.x2 - 7 : ln.x2 + 7}
                      y1={ln.y2 - 6}
                      x2={ln.fin === 'gauche' ? ln.x2 - 7 : ln.x2 + 7}
                      y2={ln.y2 + 6}
                    />
                  )}
                </g>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
