"""Génération de suggestions de correction par le LLM (le « LLM suggère »).

L'appel LLM est INJECTÉ (paramètre appeler_llm) : en production on passe le vrai
client Groq ; dans les tests on passe un faux. La sortie du LLM est du JSON non
fiable, validé par Pydantic (« Pydantic aux frontières »).
"""

from collections.abc import Callable
from typing import Literal

from pydantic import BaseModel

from app.rules import Issue


class Suggestion(BaseModel):
    probleme: str          # reformulation du problème détecté
    correction: str        # correction proposée, en clair
    ddl_corrige: str       # DDL PostgreSQL corrigé
    justification: str     # justification pédagogique


Langue = Literal["fr", "en"]

# Consigne de langue ajoutée au prompt : le front laisse choisir FR ou EN, et
# les textes rédigés par le LLM doivent suivre ce choix.
CONSIGNE_LANGUE: dict[str, str] = {
    "fr": "Rédige les textes (probleme, correction, justification) en français.",
    "en": "Write the texts (probleme, correction, justification) in English.",
}


def construire_prompt(issue: Issue, ddl: str, lang: Langue = "fr") -> str:
    """Construit le prompt envoyé au LLM pour un problème donné."""
    return (
        "Tu es un expert en modélisation de bases de données PostgreSQL.\n"
        f"Voici le DDL analysé :\n{ddl}\n\n"
        f"Problème détecté (règle « {issue.rule} ») sur la table « {issue.table} » : "
        f"{issue.message}\n\n"
        "Propose une correction. Dans ddl_corrige, donne uniquement l'instruction "
        "CREATE TABLE complète et corrigée de la ou des tables concernées, plus "
        "les éventuelles nouvelles tables nécessaires ; ne recopie pas les autres.\n"
        f"{CONSIGNE_LANGUE[lang]}\n"
        "Réponds UNIQUEMENT en JSON, avec exactement ces "
        'clés : "probleme", "correction", "ddl_corrige", "justification".'
    )


def generer_suggestion(
    issue: Issue,
    ddl: str,
    appeler_llm: Callable[[str], str],
    lang: Langue = "fr",
) -> Suggestion:
    """Demande une correction au LLM et valide sa réponse JSON via Pydantic."""
    prompt = construire_prompt(issue, ddl, lang)
    reponse_json = appeler_llm(prompt)  # chaîne JSON renvoyée par le LLM
    # model_validate_json échoue si le JSON est invalide ou s'il manque une clé.
    return Suggestion.model_validate_json(reponse_json)
