"""Point d'entrée de l'API SchemaForge."""

from collections.abc import Callable
from datetime import datetime

from fastapi import Depends, FastAPI
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import enregistrer_analyse, get_session, lister_analyses
from app.generation import SchemaSpec, generer_modele, rendre_ddl
from app.llm import appeler_groq
from app.rules import Issue, analyser
from app.suggestions import Suggestion, generer_suggestion

# Instance aiguillant les requêtes ; uvicorn la démarre via "app.main:app".
app = FastAPI(title="SchemaForge API")


class AnalyzeRequest(BaseModel):
    # Pydantic valide le corps de la requête : "ddl" doit être une chaîne présente.
    ddl: str


class GenerateRequest(BaseModel):
    # Description en langage naturel du schéma souhaité.
    description: str


class GenerateResponse(BaseModel):
    modele: SchemaSpec  # le modèle relationnel conçu par le LLM
    ddl: str            # le DDL PostgreSQL généré à partir du modèle


class ProblemeOut(BaseModel):
    # from_attributes : autorise Pydantic à lire les attributs d'un objet ORM.
    model_config = ConfigDict(from_attributes=True)
    rule: str
    table: str
    message: str


class AnalyseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ddl: str
    created_at: datetime
    problemes: list[ProblemeOut]


def fournir_llm() -> Callable[[str], str]:
    # La "prise" : en prod on branche le vrai Groq ; en test on l'override par un faux.
    return appeler_groq


@app.get("/health")
def health() -> dict[str, str]:
    # Route de santé : confirme que le service est vivant. FastAPI renvoie ce dict en JSON.
    return {"status": "ok"}


@app.post("/analyze")
def analyze(
    request: AnalyzeRequest,
    session: Session = Depends(get_session),
) -> list[Issue]:
    # Le moteur déterministe détecte les incohérences...
    issues = analyser(request.ddl)
    # ...et on enregistre l'analyse dans l'historique.
    enregistrer_analyse(session, request.ddl, issues)
    return issues


@app.post("/suggest")
def suggest(
    request: AnalyzeRequest,
    appeler_llm: Callable[[str], str] = Depends(fournir_llm),
) -> list[Suggestion]:
    # Le déterministe détecte, le LLM suggère : une suggestion par problème trouvé.
    issues = analyser(request.ddl)
    return [generer_suggestion(issue, request.ddl, appeler_llm) for issue in issues]


@app.post("/generate")
def generate(
    request: GenerateRequest,
    appeler_llm: Callable[[str], str] = Depends(fournir_llm),
) -> GenerateResponse:
    # Langage naturel -> modèle relationnel (LLM) -> DDL PostgreSQL (déterministe).
    modele = generer_modele(request.description, appeler_llm)
    return GenerateResponse(modele=modele, ddl=rendre_ddl(modele))


@app.get("/history")
def history(session: Session = Depends(get_session)) -> list[AnalyseOut]:
    # Relit l'historique des analyses enregistrées (plus récentes d'abord).
    return lister_analyses(session)
