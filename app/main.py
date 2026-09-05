"""Point d'entrée de l'API SchemaForge (squelette : route de santé /health)."""

from fastapi import FastAPI

# Instance aiguillant les requêtes ; uvicorn la démarre via "app.main:app".
app = FastAPI(title="SchemaForge API")


@app.get("/health")
def health() -> dict[str, str]:
    # Route de santé : confirme que le service est vivant. FastAPI renvoie ce dict en JSON.
    return {"status": "ok"}
