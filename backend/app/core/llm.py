from google import genai
from google.genai import errors

from ..config import settings


PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-3.5-flash"


client = genai.Client(
    api_key=settings.google_api_key
)


async def gemini_chat_query(
    query: str,
    model: str = PRIMARY_MODEL,
) -> str:
    """
    Send a single prompt using Gemini async chat mode.
    """

    chat = client.aio.chats.create(
        model=model
    )

    response = await chat.send_message(
        query
    )

    return response.text


async def gemini_chat_with_fallback(
    query: str,
) -> str:
    """
    Try the primary Gemini model first.
    If it is temporarily unavailable, use the fallback model.
    """

    try:
        print(
            f">>> Calling primary model: {PRIMARY_MODEL}"
        )

        return await gemini_chat_query(
            query=query,
            model=PRIMARY_MODEL,
        )

    except errors.ServerError as exc:
        print(
            f">>> Primary model unavailable: {exc}"
        )

        print(
            f">>> Falling back to: {FALLBACK_MODEL}"
        )

        return await gemini_chat_query(
            query=query,
            model=FALLBACK_MODEL,
        )
