"""Tests du générateur de DDL déterministe (app/generation.py)."""

from app.generation import ColumnSpec, SchemaSpec, TableSpec, rendre_ddl
from app.parsing import parse_ddl


def test_rendre_ddl_table_simple():
    schema = SchemaSpec(tables=[
        TableSpec(name="users", columns=[
            ColumnSpec(name="id", type="SERIAL", primary_key=True, nullable=False),
            ColumnSpec(name="email", type="TEXT", nullable=False),
        ])
    ])
    ddl = rendre_ddl(schema)

    assert "CREATE TABLE users" in ddl
    assert "id SERIAL PRIMARY KEY" in ddl
    assert "email TEXT NOT NULL" in ddl


def test_rendre_ddl_cle_etrangere():
    schema = SchemaSpec(tables=[
        TableSpec(name="posts", columns=[
            ColumnSpec(name="id", type="SERIAL", primary_key=True),
            ColumnSpec(name="user_id", type="INT", references="users(id)"),
        ])
    ])
    ddl = rendre_ddl(schema)

    assert "user_id INT REFERENCES users(id)" in ddl


def test_ddl_genere_est_reparsable():
    # Le DDL produit doit être valide : on le repasse dans notre propre parser.
    schema = SchemaSpec(tables=[
        TableSpec(name="clients", columns=[
            ColumnSpec(name="id", type="SERIAL", primary_key=True),
            ColumnSpec(name="nom", type="TEXT"),
        ])
    ])
    ddl = rendre_ddl(schema)

    tables = parse_ddl(ddl)
    assert tables[0].name == "clients"
    assert tables[0].has_primary_key is True
