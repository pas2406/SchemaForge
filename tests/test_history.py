"""Tests de l'historique (app/database.py) sur une base SQLite en mémoire."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, enregistrer_analyse, lister_analyses
from app.rules import Issue


@pytest.fixture
def session():
    # Base SQLite en mémoire : créée puis jetée à chaque test, sans PostgreSQL.
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as s:
        yield s


def test_enregistrer_analyse_persiste_ses_problemes(session):
    issues = [
        Issue(rule="pk_manquante", table="logs", message="pas de PK"),
        Issue(rule="fk_manquante", table="logs", message="user_id sans FK"),
    ]
    analyse = enregistrer_analyse(session, "CREATE TABLE logs (user_id INT);", issues)

    assert analyse.id is not None
    assert analyse.ddl.startswith("CREATE TABLE logs")
    assert len(analyse.problemes) == 2
    assert analyse.problemes[0].rule == "pk_manquante"


def test_lister_analyses_renvoie_tout(session):
    enregistrer_analyse(session, "CREATE TABLE a (id INT);", [])
    enregistrer_analyse(session, "CREATE TABLE b (id INT);", [])

    analyses = lister_analyses(session)
    assert len(analyses) == 2
