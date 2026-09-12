"""Frontière externe : le vrai appel au LLM (Groq, API compatible OpenAI).

Seul point du code qui parle au réseau. Le reste (règles, suggestions) est
testé sans lui, via un faux LLM injecté.
"""

import httpx

from app.config import settings


def appeler_groq(prompt: str) -> str:
    """Envoie le prompt à Groq et renvoie le contenu JSON de la réponse (texte)."""
    reponse = httpx.post(
        f"{settings.groq_base_url}/chat/completions",
        headers={"Authorization": f"Bearer {settings.groq_api_key}"},
        json={
            "model": settings.groq_model,
            "messages": [{"role": "user", "content": prompt}],
            # Force le modèle à répondre en JSON (validé ensuite par Pydantic).
            "response_format": {"type": "json_object"},
        },
        timeout=30.0,
    )
    reponse.raise_for_status()  # lève une erreur claire si la requête a échoué
    return reponse.json()["choices"][0]["message"]["content"]
