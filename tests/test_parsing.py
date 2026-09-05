"""Tests du parser DDL (app/parsing.py)."""

from app.parsing import parse_ddl


def test_parse_une_table_avec_colonnes():
    # 1. ARRANGE : on prépare une donnée d'entrée (un DDL simple).
    ddl = "CREATE TABLE users (id INT PRIMARY KEY, email TEXT);"

    # 2. ACT : on exécute la fonction à tester.
    tables = parse_ddl(ddl)

    # 3. ASSERT : on vérifie que le résultat est bien celui attendu.
    #    'assert' déclenche un échec du test si l'expression est fausse.
    assert len(tables) == 1              # une seule table
    assert tables[0].name == "users"    # nommée "users"

    colonnes = tables[0].columns
    assert [c.name for c in colonnes] == ["id", "email"]   # bons noms, bon ordre
    assert [c.type for c in colonnes] == ["INT", "TEXT"]   # bons types


def test_parse_plusieurs_tables():
    # Vérifie qu'un DDL avec deux CREATE TABLE renvoie bien deux tables.
    ddl = """
    CREATE TABLE users (id INT);
    CREATE TABLE orders (id INT, user_id INT);
    """
    tables = parse_ddl(ddl)

    assert [t.name for t in tables] == ["users", "orders"]


def test_parse_ignore_ce_qui_nest_pas_une_table():
    # Un CREATE INDEX ne doit PAS être compté comme une table.
    ddl = """
    CREATE TABLE users (id INT);
    CREATE INDEX idx_users_id ON users (id);
    """
    tables = parse_ddl(ddl)

    assert len(tables) == 1
    assert tables[0].name == "users"
