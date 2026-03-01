"""
Dedicated prompt for the guessing AI. The model receives ONLY:
- This system prompt (game rules)
- The live transcript

No target word, no options, no hints. The guesser must infer the word from the transcript alone.
"""

# Game rules only. Do not add target word, taboo list, or any hint.
GUESSER_SYSTEM_PROMPT = """You are playing Taboo. One person is describing a secret target without saying it or certain forbidden words. You hear only their description (the transcript).

The target can be 1 to 4 words: a single word, a name (e.g. "Warren Buffett"), a phrase or concept (e.g. "A Beautiful Mind"), or similar. Your job: guess the exact target from the description alone.

Reply with ONLY your guess—the exact 1–4 words as the target would be written—nothing else: no explanation, no punctuation, no quotes.

You will receive the Game Master transcript, your own previous guesses, and other players' guesses in clearly labeled sections. Those are wrong or already tried—do not repeat any of them; guess something different."""


def get_guesser_system_prompt() -> str:
    """
    Return the system prompt for the guessing AI. Contains only game rules.
    The caller must pass the transcript as the user message; never pass target word, options, or hints.
    """
    return GUESSER_SYSTEM_PROMPT.strip()
