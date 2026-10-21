"""Couche base de données : connexion PostgreSQL + modèles ORM de l'historique.

SQLAlchemy traduit nos objets Python (AnalyseDB, ProblemeDB) en lignes SQL.
"""

from datetime import datetime

from sqlalchemy import ForeignKey, create_engine, delete, func, select
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

# Rétention : on ne garde que les N analyses les plus récentes, pour que la
# table reste bornée (chaque clic « Analyser » ajoute une ligne).
MAX_ANALYSES = 100


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


def get_session():
    """Dépendance FastAPI : fournit une session, fermée automatiquement après usage."""
    with SessionLocal() as session:
        yield session


def enregistrer_analyse(
    session: Session,
    ddl: str,
    issues: list[Issue],
    max_analyses: int = MAX_ANALYSES,
) -> AnalyseDB:
    """Sauvegarde une analyse et ses problèmes, purge les plus anciennes, puis la renvoie."""
    analyse = AnalyseDB(
        ddl=ddl,
        problemes=[
            ProblemeDB(rule=i.rule, table=i.table, message=i.message) for i in issues
        ],
    )
    session.add(analyse)   # place l'objet dans la "conversation"
    session.flush()        # envoie l'INSERT sans valider : la purge la voit
    _purger_anciennes(session, max_analyses)
    session.commit()       # valide insertion + purge ensemble (tout ou rien)
    session.refresh(analyse)  # recharge l'objet (id, created_at remplis par la base)
    return analyse


def _purger_anciennes(session: Session, max_analyses: int) -> None:
    """Supprime les analyses au-delà des max_analyses plus récentes (sans commit)."""
    # Même tri que lister_analyses ; OFFSET saute les N à garder : il reste
    # exactement les ids à supprimer.
    en_trop = session.scalars(
        select(AnalyseDB.id)
        .order_by(AnalyseDB.created_at.desc(), AnalyseDB.id.desc())
        .offset(max_analyses)
    ).all()
    if en_trop:
        # Problèmes d'abord, puis analyses (même raison que vider_historique).
        session.execute(delete(ProblemeDB).where(ProblemeDB.analyse_id.in_(en_trop)))
        session.execute(delete(AnalyseDB).where(AnalyseDB.id.in_(en_trop)))


def lister_analyses(session: Session, limite: int | None = None) -> list[AnalyseDB]:
    """Renvoie les analyses enregistrées, de la plus récente à la plus ancienne."""
    # id en second critère : deux analyses à la même horodate gardent un ordre stable.
    requete = select(AnalyseDB).order_by(AnalyseDB.created_at.desc(), AnalyseDB.id.desc())
    if limite is not None:
        # LIMIT côté SQL : la base ne renvoie que les N lignes utiles, au lieu
        # de tout charger en Python puis de couper.
        requete = requete.limit(limite)
    return list(session.scalars(requete))


def supprimer_analyse(session: Session, analyse_id: int) -> bool:
    """Supprime une analyse et ses problèmes ; False si l'id n'existe pas."""
    analyse = session.get(AnalyseDB, analyse_id)
    if analyse is None:
        return False
    # session.delete (objet par objet) applique la cascade de la relation :
    # les ProblemeDB de cette analyse sont supprimés avec elle.
    session.delete(analyse)
    session.commit()
    return True


def vider_historique(session: Session) -> int:
    """Supprime toutes les analyses et leurs problèmes ; renvoie le nombre d'analyses."""
    # Requêtes groupées (un seul DELETE chacune) : elles CONTOURNENT la cascade
    # de l'ORM. On efface donc d'abord les problèmes (qui pointent vers les
    # analyses), puis les analyses ; dans l'autre ordre, PostgreSQL refuserait
    # (clé étrangère analyse_id vers une ligne disparue).
    session.execute(delete(ProblemeDB))
    nombre = session.execute(delete(AnalyseDB)).rowcount
    session.commit()  # une seule transaction : tout ou rien
    return nombre
