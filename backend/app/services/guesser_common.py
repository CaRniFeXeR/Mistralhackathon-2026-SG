from typing import Any


def build_guesser_messages(
    system_prompt: str,
    transcript_content: str,
    chat_history: list[dict[str, str]] | None = None,
) -> tuple[list[dict[str, str]], list[dict[str, str]], str]:
    """
    Build history, messages, and user_content for the guesser backends.
    This is shared between the Mistral and vLLM implementations.
    """
    history: list[dict[str, str]] = list(chat_history or [])
    label = "Transcript so far" if not history else "New clues added"
    user_content = f"{label}: {transcript_content}"

    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        *history,
        {"role": "user", "content": user_content},
    ]
    return history, messages, user_content


def update_chat_history(
    history: list[dict[str, str]],
    user_content: str,
    assistant_reply: str,
) -> list[dict[str, str]]:
    """
    Append the latest user and assistant turns to the provided history.
    """
    return history + [
        {"role": "user", "content": user_content},
        {"role": "assistant", "content": assistant_reply},
    ]

