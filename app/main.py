"""Point d'entrée de l'API SchemaForge."""

from fastapi import FastAPI
from pydantic import BaseModel

from app.rules import Issue, analyser

# Instance aiguillant les requêtes ; uvicorn la démarre via "app.main:app".
app = FastAPI(title="SchemaForge API")


class AnalyzeRequest(BaseModel):
    # Pydantic valide le corps de la requête : "ddl" doit être une chaîne présente.
    ddl: str


@app.get("/health")
def health() -> dict[str, str]:
    # Route de santé : confirme que le service est vivant. FastAPI renvoie ce dict en JSON.
    return {"status": "ok"}


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> list[Issue]:
    # Le moteur déterministe détecte les incohérences ; FastAPI sérialise les Issue en JSON.
    return analyser(request.ddl)
