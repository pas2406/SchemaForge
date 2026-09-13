"""Génération déterministe de DDL PostgreSQL à partir d'un modèle relationnel.

Le LLM produit le modèle (SchemaSpec, validé par Pydantic) ; ce module le
transforme en SQL de façon déterministe et fiable.
"""

from pydantic import BaseModel


class ColumnSpec(BaseModel):
    name: str
    type: str
    primary_key: bool = False
    nullable: bool = True
    references: str | None = None  # ex. "users(id)" pour une clé étrangère


class TableSpec(BaseModel):
    name: str
    columns: list[ColumnSpec]


class SchemaSpec(BaseModel):
    tables: list[TableSpec]


def _rendre_colonne(col: ColumnSpec) -> str:
    """Rend une colonne en SQL, ex. 'id SERIAL PRIMARY KEY'."""
    morceaux = [col.name, col.type]
    if col.primary_key:
        morceaux.append("PRIMARY KEY")  # PK implique déjà NOT NULL
    elif not col.nullable:
        morceaux.append("NOT NULL")
    if col.references:
        morceaux.append(f"REFERENCES {col.references}")
    return " ".join(morceaux)


def rendre_ddl(schema: SchemaSpec) -> str:
    """Transforme un modèle relationnel en DDL PostgreSQL."""
    blocs = []
    for table in schema.tables:
        lignes = ",\n".join(f"    {_rendre_colonne(c)}" for c in table.columns)
        blocs.append(f"CREATE TABLE {table.name} (\n{lignes}\n);")
    return "\n\n".join(blocs)
