"""Tests de la génération de suggestions (app/suggestions.py), avec un faux LLM."""

from app.rules import Issue
from app.suggestions import Suggestion, generer_suggestion


def faux_llm(prompt: str) -> str:
    """Faux LLM : renvoie une réponse JSON figée, sans aucun appel réseau."""
    return (
        '{"probleme": "La table logs n\'a pas de clé primaire.",'
        ' "correction": "Ajouter une colonne id en clé primaire.",'
        ' "ddl_corrige": "CREATE TABLE logs (id SERIAL PRIMARY KEY, message TEXT);",'
        ' "justification": "Une PK identifie chaque ligne de façon unique."}'
    )


def test_generer_suggestion_valide_le_json_du_llm():
    issue = Issue(rule="pk_manquante", table="logs", message="pas de PK")

    suggestion = generer_suggestion(
        issue,
        "CREATE TABLE logs (message TEXT);",
        appeler_llm=faux_llm,
    )

    assert isinstance(suggestion, Suggestion)
    assert "PRIMARY KEY" in suggestion.ddl_corrige
    assert suggestion.justification != ""


def test_generer_suggestion_transmet_un_prompt_au_llm():
    # On capture le prompt reçu pour vérifier qu'il mentionne le problème.
    prompts_recus = []

    def llm_espion(prompt: str) -> str:
        prompts_recus.append(prompt)
        return faux_llm(prompt)

    issue = Issue(rule="pk_manquante", table="logs", message="pas de PK")
    generer_suggestion(issue, "CREATE TABLE logs (message TEXT);", appeler_llm=llm_espion)

    assert len(prompts_recus) == 1
    assert "logs" in prompts_recus[0]  # le prompt parle bien de la table concernée
