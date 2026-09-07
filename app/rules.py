"""Moteur de règles déterministes : détecte les incohérences d'un schéma.

Principe du projet : « le déterministe détecte, le LLM suggère, l'humain valide ».
Chaque règle prend les tables parsées et renvoie une liste d'Issue (problèmes trouvés).
"""

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
