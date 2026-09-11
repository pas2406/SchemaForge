"""Tests de l'API HTTP (app/main.py) via le TestClient de FastAPI."""

from fastapi.testclient import TestClient

from app.main import app

# TestClient appelle l'app en mémoire, sans lancer uvicorn ni ouvrir de port.
client = TestClient(app)


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
