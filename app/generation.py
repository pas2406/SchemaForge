"""Génération déterministe de DDL PostgreSQL à partir d'un modèle relationnel.

Le LLM produit le modèle (SchemaSpec, validé par Pydantic) ; ce module le
transforme en SQL de façon déterministe et fiable.
"""

from collections.abc import Callable

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


def construire_prompt_generation(description: str) -> str:
    """Construit le prompt demandant au LLM un modèle relationnel normalisé."""
    return (
        "Tu es un expert en modélisation de bases de données PostgreSQL.\n"
        f"Conçois un schéma relationnel normalisé (au moins en 3NF) pour : {description}\n\n"
        "Réponds UNIQUEMENT en JSON avec cette structure exacte :\n"
        '{"tables": [{"name": "...", "columns": [{"name": "...", "type": "...", '
        '"primary_key": true/false, "nullable": true/false, '
        '"references": "table(colonne) ou null"}]}]}'
    )


def generer_modele(
    description: str,
    appeler_llm: Callable[[str], str],
) -> SchemaSpec:
    """Demande au LLM un modèle relationnel et valide sa réponse JSON via Pydantic."""
    reponse_json = appeler_llm(construire_prompt_generation(description))
    return SchemaSpec.model_validate_json(reponse_json)
