"""Point d'entrée de l'API SchemaForge."""

from collections.abc import Callable
from datetime import datetime

from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import enregistrer_analyse, get_session, lister_analyses
from app.generation import SchemaSpec, generer_modele, rendre_ddl
from app.llm import appeler_groq
from app.parsing import DDLInvalide
from app.rules import Issue, analyser
from app.suggestions import Langue, Suggestion, generer_suggestion

# Instance aiguillant les requêtes ; uvicorn la démarre via "app.main:app".
app = FastAPI(title="SchemaForge API")

# Autorise le front (servi par Vite) à appeler l'API depuis le navigateur.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DDLInvalide)
async def _gerer_ddl_invalide(request: Request, exc: DDLInvalide) -> JSONResponse:
    # SQL invalide -> 400 (au lieu d'un 500 brut), avec un message lisible.
    return JSONResponse(status_code=400, content={"detail": str(exc)})


class AnalyzeRequest(BaseModel):
    # Pydantic valide le corps de la requête : "ddl" doit être une chaîne présente.
    ddl: str


class SuggestIssueRequest(BaseModel):
    # Le DDL + un seul problème détecté (pour suggérer sa correction à la demande).
    ddl: str
    rule: str
    table: str
    message: str
    # Langue des textes rédigés par le LLM ; Literal -> toute autre valeur donne un 422.
    lang: Langue = "fr"


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


@app.post("/suggest-issue")
def suggest_issue(
    request: SuggestIssueRequest,
    appeler_llm: Callable[[str], str] = Depends(fournir_llm),
) -> Suggestion:
    # Correction à la demande pour UN seul problème (le front appelle par issue).
    issue = Issue(rule=request.rule, table=request.table, message=request.message)
    return generer_suggestion(issue, request.ddl, appeler_llm, request.lang)


@app.post("/generate")
def generate(
    request: GenerateRequest,
    appeler_llm: Callable[[str], str] = Depends(fournir_llm),
) -> GenerateResponse:
    # Langage naturel -> modèle relationnel (LLM) -> DDL PostgreSQL (déterministe).
    modele = generer_modele(request.description, appeler_llm)
    return GenerateResponse(modele=modele, ddl=rendre_ddl(modele))


@app.get("/history")
def history(
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
) -> list[AnalyseOut]:
    # Relit les dernières analyses (plus récentes d'abord). limit borné : la table
    # grossit à chaque /analyze, on ne renvoie jamais tout d'un coup.
    return lister_analyses(session, limite=limit)
