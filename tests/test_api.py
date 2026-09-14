"""Tests de l'API HTTP (app/main.py) via le TestClient de FastAPI."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_session
from app.main import app, fournir_llm

# Base SQLite en mémoire partagée pour tous les tests API (pas de PostgreSQL).
# StaticPool + check_same_thread : une seule connexion partagée par le TestClient.
_moteur_test = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(_moteur_test)
_SessionTest = sessionmaker(bind=_moteur_test)


def _session_de_test():
    with _SessionTest() as s:
        yield s


# On branche la session SQLite à la place de PostgreSQL pour toute la durée des tests.
app.dependency_overrides[get_session] = _session_de_test

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


def faux_llm_schema(prompt: str) -> str:
    """Faux LLM injecté dans /generate : renvoie un modèle relationnel figé."""
    return (
        '{"tables": [{"name": "articles", "columns": ['
        '{"name": "id", "type": "SERIAL", "primary_key": true},'
        '{"name": "titre", "type": "TEXT", "nullable": false}]}]}'
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
        # On retire UNIQUEMENT l'override du LLM (garder celui de la session SQLite).
        app.dependency_overrides.pop(fournir_llm, None)


def test_generate_retourne_le_modele_et_le_ddl():
    app.dependency_overrides[fournir_llm] = lambda: faux_llm_schema
    try:
        response = client.post("/generate", json={"description": "un blog"})
        assert response.status_code == 200

        data = response.json()
        assert data["modele"]["tables"][0]["name"] == "articles"
        assert "CREATE TABLE articles" in data["ddl"]
        assert "id SERIAL PRIMARY KEY" in data["ddl"]
    finally:
        # On retire UNIQUEMENT l'override du LLM (garder celui de la session SQLite).
        app.dependency_overrides.pop(fournir_llm, None)


def test_generate_rejette_corps_sans_description():
    # Pydantic rejette un corps sans "description" -> 422.
    assert client.post("/generate", json={}).status_code == 422


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
        # On retire UNIQUEMENT l'override du LLM (garder celui de la session SQLite).
        app.dependency_overrides.pop(fournir_llm, None)


def test_history_relit_les_analyses_enregistrees():
    # Une analyse enregistrée via /analyze doit réapparaître dans /history.
    client.post("/analyze", json={"ddl": "CREATE TABLE journal (contenu TEXT);"})

    response = client.get("/history")
    assert response.status_code == 200

    analyses = response.json()
    ddls = [a["ddl"] for a in analyses]
    assert any(d.startswith("CREATE TABLE journal") for d in ddls)
    # Chaque analyse expose bien sa liste de problèmes.
    assert isinstance(analyses[0]["problemes"], list)
