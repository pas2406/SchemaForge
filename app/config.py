"""Configuration de l'application, chargée et validée depuis l'environnement (.env).

« Pydantic aux frontières » appliqué à la config : si une variable manque, l'app
refuse de démarrer avec un message clair plutôt que de planter plus tard.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Lit automatiquement le fichier .env ; ignore les variables non déclarées ici.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Clé API Groq (obligatoire — pas de valeur par défaut).
    groq_api_key: str

    # Modèle et URL de l'API Groq (valeurs par défaut modifiables via .env).
    groq_model: str = "openai/gpt-oss-20b"
    groq_base_url: str = "https://api.groq.com/openai/v1"


# Instance unique, importable partout : from app.config import settings
settings = Settings()
