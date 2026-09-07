"""Tests du moteur de règles (app/rules.py)."""

from app.parsing import parse_ddl
from app.rules import detecter_fk_manquante, detecter_pk_manquante


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


def test_fk_signale_colonne_id_sans_fk():
    # user_id finit par _id et n'a pas de FK -> on signale.
    tables = parse_ddl("CREATE TABLE orders (id INT PRIMARY KEY, user_id INT);")
    issues = detecter_fk_manquante(tables)

    assert len(issues) == 1
    assert issues[0].rule == "fk_manquante"
    assert issues[0].table == "orders"
    assert "user_id" in issues[0].message


def test_fk_aucune_alerte_si_fk_declaree():
    # user_id a déjà une FK -> aucune alerte.
    tables = parse_ddl(
        "CREATE TABLE orders (id INT, user_id INT REFERENCES users(id));"
    )
    assert detecter_fk_manquante(tables) == []


def test_fk_ignore_colonnes_sans_suffixe_id():
    # Aucune colonne en _id -> aucune alerte (id seul ne compte pas).
    tables = parse_ddl("CREATE TABLE users (id INT PRIMARY KEY, email TEXT);")
    assert detecter_fk_manquante(tables) == []
