"""Tests de l'historique (app/database.py) sur une base SQLite en mémoire."""

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.database import (
    Base,
    ProblemeDB,
    enregistrer_analyse,
    lister_analyses,
    supprimer_analyse,
    vider_historique,
)
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


def test_lister_analyses_limite_garde_les_plus_recentes(session):
    for nom in ("a", "b", "c"):
        enregistrer_analyse(session, f"CREATE TABLE {nom} (id INT);", [])

    analyses = lister_analyses(session, limite=2)
    # Seules les 2 dernières, la plus récente en tête.
    assert [a.ddl[13] for a in analyses] == ["c", "b"]


def _nb_problemes(session) -> int:
    return session.scalar(select(func.count()).select_from(ProblemeDB))


def test_supprimer_analyse_efface_aussi_ses_problemes(session):
    pb = [Issue(rule="pk_manquante", table="t", message="pas de PK")]
    gardee = enregistrer_analyse(session, "CREATE TABLE a (x INT);", pb)
    supprimee = enregistrer_analyse(session, "CREATE TABLE b (x INT);", pb)

    assert supprimer_analyse(session, supprimee.id) is True
    assert [a.id for a in lister_analyses(session)] == [gardee.id]
    # Cascade : le problème de l'analyse supprimée ne reste pas orphelin.
    assert _nb_problemes(session) == 1


def test_supprimer_analyse_inconnue_renvoie_false(session):
    assert supprimer_analyse(session, 999) is False


def test_vider_historique_ne_laisse_aucun_orphelin(session):
    pb = [Issue(rule="pk_manquante", table="t", message="pas de PK")]
    enregistrer_analyse(session, "CREATE TABLE a (x INT);", pb)
    enregistrer_analyse(session, "CREATE TABLE b (x INT);", pb)

    assert vider_historique(session) == 2
    assert lister_analyses(session) == []
    assert _nb_problemes(session) == 0
