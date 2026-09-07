"""Parsing d'un DDL SQL en structure Python exploitable par le moteur de règles.

On s'appuie sur sqlglot (AST) plutôt que sur des recherches de texte : plus fiable.
"""
# Le module dataclass sert à facilement créer des classes qui ont principalement pour rôle de stocker des données.

from dataclasses import dataclass, field

import sqlglot
from sqlglot import exp


@dataclass
class Column:
    name: str
    type: str  # type SQL normalisé, ex. "INT", "TEXT"


@dataclass
class Table:
    name: str
    # default_factory=list : chaque Table démarre avec sa PROPRE liste vide.
    # (Écrire "= []" partagerait une seule liste entre toutes les tables, d'où l'utilisation de field pour donner une valeur par défaut à l'attribut.)
    columns: list[Column] = field(default_factory=list)
    has_primary_key: bool = False  # la table a-t-elle une clé primaire (col. OU table) ?


def parse_ddl(ddl: str) -> list[Table]:
    """Transforme un DDL PostgreSQL en liste de tables avec leurs colonnes."""
    tables: list[Table] = []  # on accumulera ici les tables trouvées

    # sqlglot.parse() lit TOUT le DDL et renvoie une liste d'arbres (un par énoncé SQL).
    # read="postgres" : on lui dit d'interpréter la syntaxe façon PostgreSQL.
    for statement in sqlglot.parse(ddl, read="postgres"):

        # Un DDL peut contenir autre chose que des tables (CREATE INDEX, CREATE VIEW...).
        # On ignore tout ce qui n'est pas un "CREATE TABLE".
        #   - isinstance(..., exp.Create) : est-ce un énoncé de création ?
        #   - statement.kind == "TABLE"   : crée-t-il bien une TABLE (et pas un index/vue) ?
        if not isinstance(statement, exp.Create) or statement.kind != "TABLE":
            continue  # on saute cet énoncé et on passe au suivant

        # Récupérer le nom de la table. Dans l'arbre, la structure est imbriquée :
        #   Create -> .this (le Schema) -> .this (la Table) -> .name (le texte "users")
        table_name = statement.this.this.name

        # Récupérer toutes les colonnes de CETTE table.
        # find_all(exp.ColumnDef) parcourt l'arbre et renvoie chaque définition de colonne.
        columns = [
            Column(
                name=col.name,               # nom de la colonne, ex. "email"
                type=col.args["kind"].sql(), # son type ; .sql() le reconvertit en texte, ex. "TEXT"
            )
            for col in statement.find_all(exp.ColumnDef)
        ]

        # Une PK peut être déclarée sur une colonne (PRIMARY KEY après le type)
        # OU au niveau de la table (PRIMARY KEY (...)). On accepte les deux formes.
        has_pk = any(statement.find_all(exp.PrimaryKeyColumnConstraint)) or any(
            statement.find_all(exp.PrimaryKey)
        )

        # On range la table complète (nom + colonnes + PK) dans notre liste de résultats.
        tables.append(
            Table(name=table_name, columns=columns, has_primary_key=has_pk)
        )

    return tables
