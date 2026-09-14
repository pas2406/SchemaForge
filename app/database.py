"""Couche base de données : connexion PostgreSQL + modèles ORM de l'historique.

SQLAlchemy traduit nos objets Python (AnalyseDB, ProblemeDB) en lignes SQL.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, create_engine, func, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    sessionmaker,
)

from app.config import settings
from app.rules import Issue

# Le moteur gère les connexions à PostgreSQL (adresse lue depuis .env).
engine = create_engine(settings.database_url)

# Fabrique de sessions : chaque session est une "conversation" avec la base.
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    """Classe parente de tous les modèles ORM."""


class AnalyseDB(Base):
    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    ddl: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    # Une analyse a plusieurs problèmes (relation 1-à-N).
    problemes: Mapped[list["ProblemeDB"]] = relationship(
        back_populates="analyse", cascade="all, delete-orphan"
    )


class ProblemeDB(Base):
    __tablename__ = "problemes"

    id: Mapped[int] = mapped_column(primary_key=True)
    analyse_id: Mapped[int] = mapped_column(ForeignKey("analyses.id"))
    rule: Mapped[str]
    table: Mapped[str]
    message: Mapped[str]

    # Chaque problème appartient à une analyse.
    analyse: Mapped["AnalyseDB"] = relationship(back_populates="problemes")


def creer_tables() -> None:
    """Crée les tables dans PostgreSQL si elles n'existent pas encore."""
    Base.metadata.create_all(engine)


def enregistrer_analyse(
    session: Session,
    ddl: str,
    issues: list[Issue],
) -> AnalyseDB:
    """Sauvegarde une analyse et ses problèmes détectés, puis la renvoie."""
    analyse = AnalyseDB(
        ddl=ddl,
        problemes=[
            ProblemeDB(rule=i.rule, table=i.table, message=i.message) for i in issues
        ],
    )
    session.add(analyse)   # place l'objet dans la "conversation"
    session.commit()       # écrit réellement en base
    session.refresh(analyse)  # recharge l'objet (id, created_at remplis par la base)
    return analyse


def lister_analyses(session: Session) -> list[AnalyseDB]:
    """Renvoie toutes les analyses enregistrées, de la plus récente à la plus ancienne."""
    requete = select(AnalyseDB).order_by(AnalyseDB.created_at.desc())
    return list(session.scalars(requete))
