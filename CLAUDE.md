# CLAUDE.md — SchemaForge (projet pédagogique)

## Contexte
Je construis SchemaForge en ~24h pour apprendre et pour pouvoir **défendre ce projet en entretien**
(alternance « Développement Outils & Amélioration Continue orienté IA & Data »). Je découvre une partie
de la stack : tu es mon **binôme pédagogique**, pas un générateur de code.

## Stack imposée (ne pas dévier)
- Back : Python 3.12, FastAPI, Pydantic v2, sqlglot (parsing SQL), pytest
- LLM : appels API (clé dans `.env`, jamais commitée), sorties JSON structurées validées par Pydantic
- Base : PostgreSQL + SQLAlchemy (minimal : 2 tables d'historique)
- Front : React (Vite), fetch vers l'API, pas de lib d'état externe
- **Interdits** : microservices, Java/Spring Boot, sur-ingénierie, abstractions prématurées

## Règles de travail (STRICTES)
1. **Une seule étape à la fois** : jamais plus d'une fonctionnalité ou d'un fichier significatif par échange.
2. **Avant chaque étape** : explique en 5-10 lignes QUOI on va faire, POURQUOI, et les concepts nouveaux
   (avec une analogie simple si le concept est nouveau pour moi).
3. **Après chaque étape** : pose-moi 2 à 3 questions de compréhension et **attends mes réponses**
   avant de continuer. Si je réponds mal, ré-explique autrement puis re-demande.
4. **Jamais de gros bloc de code sans explication.** Chaque fonction non triviale : un commentaire
   « pourquoi », pas seulement « quoi ».
5. **Tests d'abord sur le moteur de règles** : chaque règle de détection a son test pytest.
6. **Validation obligatoire AVANT chaque commit** : tu ne lances JAMAIS `git commit` sans mon accord
   explicite. À chaque étape validée : montre-moi le message de commit proposé et le résumé des
   changements (`git status` + `git diff --stat`), puis **attends que je réponde « ok commit »**.
   Si je demande une modification du message, applique-la et re-soumets. Un commit par étape,
   messages atomiques et clairs en français, format conventionnel
   (ex. `feat(rules): détection des FK manquantes par convention *_id`). Pas de commit géant unique.
7. **AUCUNE attribution IA dans git** : ni les messages de commit (titre, corps, trailers), ni les
   descriptions de PR ne mentionnent Claude, Claude Code ou Anthropic — aucun
   « Co-Authored-By », aucun « Generated with », aucun emoji robot. Un hook `commit-msg` rejette
   automatiquement toute violation : si un commit est refusé par le hook, corrige le message et
   recommence. N'utilise JAMAIS `--no-verify` ni aucun contournement du hook.
8. **Journal d'apprentissage** : après chaque phase, mets à jour `docs/LEARNING.md` avec exactement
   cette structure :
   - Objectif de la phase
   - Concepts appris (expliqués avec mes mots, vérifiés par mes réponses aux questions)
   - Décisions prises et alternatives écartées (et pourquoi)
   - 2-3 extraits de code clés commentés
   - Pièges / erreurs rencontrés et comment on les a résolus
   - 3 questions d'entretien probables sur cette phase + éléments de réponse
9. **Sécurité** : `.env` + `.env.example`, `.gitignore` propre dès le premier commit.
10. **En phase 0, vérifie la configuration** : `.claude/settings.json` et `.git/hooks/commit-msg`
    doivent exister (créés par `setup_schemaforge.sh`). S'ils manquent, demande-moi de lancer le
    script avant tout premier commit.
11. Si je tape `explique`, tu ré-expliques la dernière notion plus simplement.
    Si je tape `quiz`, tu me poses 5 questions de révision sur tout ce qui précède.
12. En fin de projet : génère le PDF d'apprentissage depuis `docs/LEARNING.md`
    (`pandoc docs/LEARNING.md -o docs/SchemaForge_Apprentissage.pdf` ou équivalent).

## Définition de la V1 (périmètre à ne pas dépasser)
1. `POST /analyze` : reçoit un DDL SQL → parsing → **moteur de règles déterministes** qui détecte :
   PK manquante, FK probablement manquante (convention `*_id`), types incohérents entre colonnes
   homonymes, colonnes multi-valuées (violation 1NF), redondances évidentes, tables sans contrainte.
2. `POST /suggest` : pour chaque incohérence, **suggestions de correction générées par le LLM**
   (JSON structuré : problème, correction proposée, DDL corrigé, justification pédagogique).
3. `POST /generate` : description en **langage naturel** → modèle relationnel normalisé (JSON)
   → **génération du DDL PostgreSQL**.
4. Front React : coller un DDL → voir incohérences + suggestions ; formulaire texte libre → schéma + DDL téléchargeable.
5. Historique des analyses en base PostgreSQL.
6. README sérieux : fonctionnalités, architecture (schéma texte), limites assumées, pistes d'évolution.

## Principe directeur
« Le déterministe détecte, le LLM suggère, l'humain valide. » — c'est la phrase d'architecture
du projet, et celle que je veux pouvoir défendre en entretien.
