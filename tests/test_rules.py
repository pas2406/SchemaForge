"""Tests du moteur de règles (app/rules.py)."""

from app.parsing import parse_ddl
from app.rules import detecter_pk_manquante


def test_signale_une_table_sans_pk():
    # Table sans clé primaire -> un problème doit être remonté.
    tables = parse_ddl("CREATE TABLE logs (message TEXT);")
    issues = detecter_pk_manquante(tables)

    assert len(issues) == 1
    assert issues[0].rule == "pk_manquante"
    assert issues[0].table == "logs"


def test_aucune_alerte_si_pk_presente():
    # Table AVEC clé primaire -> aucun problème.
    tables = parse_ddl("CREATE TABLE users (id INT PRIMARY KEY);")
    issues = detecter_pk_manquante(tables)

    assert issues == []


def test_signale_seulement_les_tables_concernees():
    # Deux tables, une seule sans PK -> un seul problème, sur la bonne table.
    ddl = """
    CREATE TABLE users (id INT PRIMARY KEY);
    CREATE TABLE logs (message TEXT);
    """
    issues = detecter_pk_manquante(parse_ddl(ddl))

    assert len(issues) == 1
    assert issues[0].table == "logs"
