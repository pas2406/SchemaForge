"""Moteur de règles déterministes : détecte les incohérences d'un schéma.

Principe du projet : « le déterministe détecte, le LLM suggère, l'humain valide ».
Chaque règle prend les tables parsées et renvoie une liste d'Issue (problèmes trouvés).
"""

from collections import defaultdict
from dataclasses import dataclass

from app.parsing import Table


@dataclass
class Issue:
    rule: str      # identifiant machine de la règle, ex. "pk_manquante"
    table: str     # nom de la table concernée
    message: str   # explication lisible par un humain


def detecter_pk_manquante(tables: list[Table]) -> list[Issue]:
    """Signale chaque table dépourvue de clé primaire."""
    issues: list[Issue] = []

    for table in tables:
        if not table.has_primary_key:
            issues.append(
                Issue(
                    rule="pk_manquante",
                    table=table.name,
                    message=f"La table « {table.name} » n'a pas de clé primaire.",
                )
            )

    return issues


def detecter_fk_manquante(tables: list[Table]) -> list[Issue]:
    """Signale les colonnes suivant la convention *_id sans clé étrangère déclarée."""
    issues: list[Issue] = []

    for table in tables:
        for col in table.columns:
            # Convention : un nom en "_id" désigne presque toujours une référence
            # vers une autre table. Sans FK déclarée, le lien n'est pas protégé.
            if col.name.endswith("_id") and not col.is_foreign_key:
                issues.append(
                    Issue(
                        rule="fk_manquante",
                        table=table.name,
                        message=(
                            f"La colonne « {table.name}.{col.name} » suit la convention "
                            "*_id mais aucune clé étrangère n'est déclarée."
                        ),
                    )
                )

    return issues


def detecter_colonnes_multivaluees(tables: list[Table]) -> list[Issue]:
    """Signale les colonnes de type tableau (violation de la 1re forme normale)."""
    issues: list[Issue] = []

    for table in tables:
        for col in table.columns:
            # sqlglot rend un type tableau sous la forme "ARRAY<...>".
            # Une case contenant plusieurs valeurs viole la 1NF.
            if col.type.startswith("ARRAY"):
                issues.append(
                    Issue(
                        rule="colonne_multivaluee",
                        table=table.name,
                        message=(
                            f"La colonne « {table.name}.{col.name} » est de type "
                            f"tableau ({col.type}) : elle stocke plusieurs valeurs, "
                            "ce qui viole la 1re forme normale (1NF)."
                        ),
                    )
                )

    return issues


def detecter_tables_sans_contrainte(tables: list[Table]) -> list[Issue]:
    """Signale les tables sans aucune contrainte (ni clé primaire, ni clé étrangère)."""
    issues: list[Issue] = []

    for table in tables:
        a_une_fk = any(col.is_foreign_key for col in table.columns)
        if not table.has_primary_key and not a_une_fk:
            issues.append(
                Issue(
                    rule="table_sans_contrainte",
                    table=table.name,
                    message=(
                        f"La table « {table.name} » n'a aucune contrainte "
                        "(ni clé primaire, ni clé étrangère)."
                    ),
                )
            )

    return issues


def detecter_types_incoherents(tables: list[Table]) -> list[Issue]:
    """Signale les colonnes de même nom ayant des types différents selon les tables."""
    # Pour chaque nom de colonne, on mémorise son type table par table.
    # defaultdict(dict) crée automatiquement un dict vide au premier accès à une clé.
    types_par_colonne: dict[str, dict[str, str]] = defaultdict(dict)
    for table in tables:
        for col in table.columns:
            types_par_colonne[col.name][table.name] = col.type

    issues: list[Issue] = []
    for nom, types_par_table in types_par_colonne.items():
        # set(...) sur les types : s'il reste plus d'un type distinct, ils divergent.
        if len(set(types_par_table.values())) > 1:
            detail = ", ".join(
                f"{type_sql} dans {nom_table}"
                for nom_table, type_sql in types_par_table.items()
            )
            issues.append(
                Issue(
                    rule="types_incoherents",
                    table=", ".join(types_par_table.keys()),
                    message=f"La colonne « {nom} » a des types différents : {detail}.",
                )
            )

    return issues
