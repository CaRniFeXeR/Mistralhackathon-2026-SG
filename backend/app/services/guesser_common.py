from typing import Any


def build_guesser_user_message(
    transcript_so_far: str,
    llm_guesses_so_far: list[str],
    other_guesses_so_far: list[tuple[str, str]],
) -> str:
    """
    Build the single structured user message for the guesser LLM.

    Contains only: Game Master transcript, LLM guesses so far, other players'
    guesses so far. Never pass target_word or taboo_words into this function.
    """
    parts: list[str] = []

    parts.append("## Game Master Transcript so far")
    parts.append(transcript_so_far.strip() if transcript_so_far else "(none yet)")
    parts.append("")

    parts.append("## Your (LLM) guesses so far")
    if llm_guesses_so_far:
        for g in llm_guesses_so_far:
            parts.append(f"- {g.strip()}")
    else:
        parts.append("(none yet)")
    parts.append("")

    parts.append("## Guesses of other players so far")
    if other_guesses_so_far:
        for display_name, guess in other_guesses_so_far:
            parts.append(f"- {display_name}: {guess.strip()}")
    else:
        parts.append("(none yet)")

    return "\n".join(parts)


def build_guesser_messages(
    system_prompt: str,
    transcript_content: str,
    chat_history: list[dict[str, str]] | None = None,
) -> tuple[list[dict[str, str]], list[dict[str, str]], str]:
    """
    Build history, messages, and user_content for the guesser backends.
    This is shared between the Mistral and vLLM implementations.

    transcript_content may be the full structured user message from
    build_guesser_user_message(). Never pass target_word or taboo_words here.
    """
    history: list[dict[str, str]] = list(chat_history or [])
    user_content = transcript_content

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

