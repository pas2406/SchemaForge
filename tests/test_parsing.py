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


def test_detecte_pk_niveau_colonne():
    # PRIMARY KEY déclarée sur la colonne.
    tables = parse_ddl("CREATE TABLE users (id INT PRIMARY KEY, email TEXT);")
    assert tables[0].has_primary_key is True


def test_detecte_pk_niveau_table():
    # PRIMARY KEY déclarée au niveau de la table.
    tables = parse_ddl("CREATE TABLE users (id INT, email TEXT, PRIMARY KEY (id));")
    assert tables[0].has_primary_key is True


def test_detecte_absence_de_pk():
    # Aucune PK : has_primary_key doit être False.
    tables = parse_ddl("CREATE TABLE logs (message TEXT);")
    assert tables[0].has_primary_key is False


def _colonne(table, nom):
    """Petit utilitaire : retrouve une colonne par son nom."""
    return next(c for c in table.columns if c.name == nom)


def test_detecte_fk_niveau_colonne():
    # FK déclarée sur la colonne (REFERENCES).
    tables = parse_ddl(
        "CREATE TABLE orders (id INT, user_id INT REFERENCES users(id));"
    )
    assert _colonne(tables[0], "user_id").is_foreign_key is True
    assert _colonne(tables[0], "id").is_foreign_key is False


def test_detecte_fk_niveau_table():
    # FK déclarée au niveau de la table.
    tables = parse_ddl(
        "CREATE TABLE orders (id INT, user_id INT, FOREIGN KEY (user_id) REFERENCES users(id));"
    )
    assert _colonne(tables[0], "user_id").is_foreign_key is True


def test_colonne_sans_fk():
    # user_id sans FK : is_foreign_key doit être False.
    tables = parse_ddl("CREATE TABLE orders (id INT, user_id INT);")
    assert _colonne(tables[0], "user_id").is_foreign_key is False
