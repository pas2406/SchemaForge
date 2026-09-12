"""Tests de l'API HTTP (app/main.py) via le TestClient de FastAPI."""

from fastapi.testclient import TestClient

from app.main import app, fournir_llm

# TestClient appelle l'app en mémoire, sans lancer uvicorn ni ouvrir de port.
client = TestClient(app)


def faux_llm(prompt: str) -> str:
    """Faux LLM injecté dans /suggest : aucune requête réseau."""
    return (
        '{"probleme": "manque une PK",'
        ' "correction": "ajouter id",'
        ' "ddl_corrige": "CREATE TABLE logs (id SERIAL PRIMARY KEY, message TEXT);",'
        ' "justification": "une PK identifie chaque ligne."}'
    )


def test_health_repond_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_analyze_retourne_les_problemes():
    # DDL avec plusieurs incohérences -> 200 + liste d'Issue en JSON.
    response = client.post(
        "/analyze",
        json={"ddl": "CREATE TABLE logs (user_id INT, message TEXT);"},
    )
    assert response.status_code == 200

    regles = {issue["rule"] for issue in response.json()}
    assert "pk_manquante" in regles
    assert "fk_manquante" in regles


def test_analyze_schema_sain_renvoie_liste_vide():
    response = client.post(
        "/analyze",
        json={"ddl": "CREATE TABLE users (id INT PRIMARY KEY, email TEXT);"},
    )
    assert response.status_code == 200
    assert response.json() == []


def test_analyze_rejette_corps_sans_ddl():
    # Pydantic doit rejeter un corps sans "ddl" -> 422.
    response = client.post("/analyze", json={})
    assert response.status_code == 422


def test_suggest_retourne_une_suggestion_par_probleme():
    # On remplace le vrai LLM par le faux, le temps du test.
    app.dependency_overrides[fournir_llm] = lambda: faux_llm
    try:
        response = client.post(
            "/suggest",
            json={"ddl": "CREATE TABLE logs (message TEXT);"},
        )
        assert response.status_code == 200

        suggestions = response.json()
        # logs : pas de PK + aucune contrainte -> 2 problèmes -> 2 suggestions.
        assert len(suggestions) == 2
        assert "PRIMARY KEY" in suggestions[0]["ddl_corrige"]
    finally:
        app.dependency_overrides.clear()


def test_suggest_schema_sain_ne_renvoie_rien():
    # Aucun problème -> aucune suggestion, et le LLM n'est jamais appelé.
    app.dependency_overrides[fournir_llm] = lambda: faux_llm
    try:
        response = client.post(
            "/suggest",
            json={"ddl": "CREATE TABLE users (id INT PRIMARY KEY, email TEXT);"},
        )
        assert response.status_code == 200
        assert response.json() == []
    finally:
        app.dependency_overrides.clear()
