# SchemaForge

SchemaForge analyse un schéma de base de données écrit en SQL (DDL), signale ses défauts de conception et propose des corrections. Il sait aussi produire un schéma PostgreSQL à partir d'une description en langage naturel.

Le projet repose sur un principe simple :

> Le déterministe détecte, le LLM suggère, l'humain valide.

La détection des problèmes est faite par des règles écrites en Python, testées et reproductibles. Le LLM n'intervient qu'ensuite, pour rédiger une correction. C'est toujours l'utilisateur qui décide de l'appliquer.

## Fonctionnalités

**Analyse d'un DDL.** On colle un schéma SQL, le moteur de règles le parse avec sqlglot puis vérifie six règles :

| Code | Règle | Exemple détecté |
|---|---|---|
| SF001 | Clé primaire manquante | `CREATE TABLE logs (message TEXT);` |
| SF002 | Clé étrangère probablement manquante | une colonne `user_id` sans `REFERENCES` |
| SF003 | Types incohérents entre colonnes homonymes | `email TEXT` dans une table, `email VARCHAR(50)` dans une autre |
| SF004 | Colonne multivaluée (violation de la 1NF) | `tags TEXT[]` |
| SF005 | Colonnes redondantes | `tel1`, `tel2`, `tel3` |
| SF006 | Table sans aucune contrainte | ni clé primaire, ni clé étrangère |

Les problèmes s'affichent dans une liste et directement dans la marge de l'éditeur. Un diagramme entité-relation est dessiné à partir du schéma.

**Suggestions de correction.** Pour chaque problème, on peut demander une correction au LLM. Il renvoie un JSON structuré (problème, correction, DDL corrigé, justification), validé par Pydantic avant d'être affiché. La correction est présentée sous forme de différences avec le DDL actuel et ne s'applique que sur un clic.

**Génération depuis le langage naturel.** On décrit un domaine métier en quelques phrases. Le LLM conçoit un modèle relationnel en JSON, puis le DDL PostgreSQL est produit à partir de ce modèle par du code Python classique, sans LLM. Le fichier `.sql` est téléchargeable.

**Historique.** Chaque analyse est enregistrée dans PostgreSQL avec ses problèmes. L'onglet Historique les liste par pages de 10, permet de rouvrir une analyse, d'en supprimer une ou de tout vider. Seules les 100 analyses les plus récentes sont conservées.

**Interface en français et en anglais.** La langue suit celle du navigateur et se change dans l'en-tête. Les suggestions du LLM sont rédigées dans la langue choisie.

## Architecture

```
Navigateur (React + Vite, port 5173)
   |
   |  fetch (JSON)
   v
API FastAPI (port 8000)          app/main.py
   |
   +-> Parsing SQL (sqlglot)     app/parsing.py
   |       |
   |       v
   |    Moteur de règles          app/rules.py        détecte
   |
   +-> LLM (Groq)                app/llm.py          suggère
   |       suggestions            app/suggestions.py
   |       génération             app/generation.py
   |
   +-> PostgreSQL (SQLAlchemy)   app/database.py     historique
```

Quelques choix structurants :

* **Le LLM est injecté.** Les routes reçoivent la fonction d'appel au LLM par `Depends`. En test, on la remplace par une fausse fonction : les tests ne font aucun appel réseau.
* **Pydantic aux frontières.** Tout ce qui entre (requêtes HTTP, réponses du LLM, configuration) est validé par un modèle Pydantic. Une réponse du LLM mal formée est rejetée au lieu de se propager.
* **La génération du DDL est déterministe.** Le LLM produit seulement le modèle (tables, colonnes, clés). Le SQL final est écrit par `rendre_ddl`, donc toujours syntaxiquement valide.
* **Deux tables pour l'historique.** `analyses` (id, ddl, date) et `problemes` (règle, table, message), reliées par une clé étrangère `analyse_id`.

### Organisation du code

```
app/
  main.py          routes FastAPI
  parsing.py       DDL -> liste de tables (sqlglot)
  rules.py         les six règles de détection
  suggestions.py   prompt et validation des suggestions du LLM
  generation.py    langage naturel -> modèle -> DDL
  llm.py           appel à l'API Groq
  database.py      modèles SQLAlchemy et accès à l'historique
  config.py        lecture et validation du fichier .env
tests/             tests pytest (règles, parsing, API, historique...)
frontend/src/
  App.jsx          écran d'analyse et onglets
  Generer.jsx      écran de génération
  Historique.jsx   écran d'historique
  Diagramme.jsx    diagramme entité-relation
  i18n/            traductions FR et EN
```

## Routes de l'API

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/analyze` | analyse un DDL et enregistre le résultat |
| POST | `/suggest` | une suggestion du LLM pour chaque problème |
| POST | `/suggest-issue` | une suggestion pour un seul problème |
| POST | `/generate` | description en langage naturel vers modèle et DDL |
| GET | `/history?limit=50` | dernières analyses enregistrées |
| DELETE | `/history/{id}` | supprime une analyse |
| DELETE | `/history` | vide l'historique |
| GET | `/health` | vérifie que l'API répond |

La documentation interactive est générée par FastAPI sur `http://localhost:8000/docs`.

## Installation

Prérequis : Python 3.12, Node.js, PostgreSQL, et une clé API Groq (gratuite sur [console.groq.com](https://console.groq.com)).

**1. Configuration**

```bash
cp .env.example .env
```

Puis renseigner dans `.env` la clé Groq et l'adresse de la base, par exemple :

```
DATABASE_URL=postgresql+psycopg://utilisateur:motdepasse@localhost:5432/schemaforge
```

**2. Backend**

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# création des tables, une seule fois
python -c "from app.database import creer_tables; creer_tables()"

uvicorn app.main:app --reload
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
```

L'application est alors disponible sur `http://localhost:5173`.

**4. Tests**

```bash
pytest
```

Les tests utilisent une base SQLite en mémoire et un faux LLM : ils ne demandent ni PostgreSQL ni clé API.

## Pistes d'évolution

* Évaluer la qualité des suggestions du LLM sur un jeu de schémas de référence.
* Renvoyer la structure des tables depuis l'API pour que le diagramme utilise le même parseur que l'analyse.
* Ne pas réenregistrer une analyse identique à la précédente.
* Ajouter de nouvelles règles, par exemple les index manquants sur les clés étrangères.
* Lancer les tests automatiquement à chaque push (intégration continue).
