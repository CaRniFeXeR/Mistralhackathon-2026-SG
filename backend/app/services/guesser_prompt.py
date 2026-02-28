"""
Dedicated prompt for the guessing AI. The model receives ONLY:
- This system prompt (game rules)
- The live transcript

No target word, no options, no hints. The guesser must infer the word from the transcript alone.
"""

# Game rules only. Do not add target word, taboo list, or any hint.
GUESSER_SYSTEM_PROMPT = """You are playing Taboo. One person is describing a secret word without saying the word itself or certain forbidden words. You hear only their description (the transcript).

Your job: guess the secret word from the description alone. Reply with ONLY the single word you guess, nothing else—no explanation, no punctuation, no quotes."""


def get_guesser_system_prompt() -> str:
    """
    Return the system prompt for the guessing AI. Contains only game rules.
    The caller must pass the transcript as the user message; never pass target word, options, or hints.
    """
    return GUESSER_SYSTEM_PROMPT.strip()
