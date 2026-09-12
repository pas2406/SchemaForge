"""Point d'entrée de l'API SchemaForge."""

from collections.abc import Callable

from fastapi import Depends, FastAPI
from pydantic import BaseModel

from app.llm import appeler_groq
from app.rules import Issue, analyser
from app.suggestions import Suggestion, generer_suggestion

# Instance aiguillant les requêtes ; uvicorn la démarre via "app.main:app".
app = FastAPI(title="SchemaForge API")


class AnalyzeRequest(BaseModel):
    # Pydantic valide le corps de la requête : "ddl" doit être une chaîne présente.
    ddl: str


def fournir_llm() -> Callable[[str], str]:
    # La "prise" : en prod on branche le vrai Groq ; en test on l'override par un faux.
    return appeler_groq


@app.get("/health")
def health() -> dict[str, str]:
    # Route de santé : confirme que le service est vivant. FastAPI renvoie ce dict en JSON.
    return {"status": "ok"}


@app.post("/analyze")
def analyze(request: AnalyzeRequest) -> list[Issue]:
    # Le moteur déterministe détecte les incohérences ; FastAPI sérialise les Issue en JSON.
    return analyser(request.ddl)


@app.post("/suggest")
def suggest(
    request: AnalyzeRequest,
    appeler_llm: Callable[[str], str] = Depends(fournir_llm),
) -> list[Suggestion]:
    # Le déterministe détecte, le LLM suggère : une suggestion par problème trouvé.
    issues = analyser(request.ddl)
    return [generer_suggestion(issue, request.ddl, appeler_llm) for issue in issues]
