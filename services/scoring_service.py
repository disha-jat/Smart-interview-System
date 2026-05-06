import re
import httpx
import json

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"


def _is_blank_or_noise(answer: str) -> bool:
    """Return True if the answer is empty, whitespace-only, or meaningless noise."""
    stripped = answer.strip()
    if not stripped:
        return True
    # Single chars or very short answers with no real content
    if len(stripped) < 3:
        return True
    # All non-alphanumeric (e.g. "??!!", "...", "---")
    if not re.search(r"[a-zA-Z0-9]", stripped):
        return True
    return False


# Scoring for GENERAL / theory questions (keyword-overlap based)

def calculate_score(user_answer: str, ideal_answer: str) -> int:
    """
    Score a general/theory answer against the ideal answer.
    Returns 0-100. Blank or noise answers always return 0.
    """
    if _is_blank_or_noise(user_answer):
        return 0

    user = user_answer.lower().strip()
    ideal = ideal_answer.lower().strip()

    # Exact match
    if user == ideal:
        return 100

    user_words = set(user.split())
    ideal_words = set(ideal.split())

    common = user_words.intersection(ideal_words)

    if not ideal_words:
        return 0

    similarity = len(common) / len(ideal_words)

    if similarity > 0.8:
        return 90
    elif similarity > 0.6:
        return 75
    elif similarity > 0.4:
        return 60
    elif similarity > 0.2:
        return 40
    else:
        # Previously returned 20 — now correctly returns 0 for low/no relevance
        return 0


# Scoring for CODING questions (AI-powered evaluation)

def calculate_coding_score(user_answer: str, ideal_answer: str, question_text: str = "") -> int:
    """
    Score a coding answer using the Claude API.
    Returns 0-100. Blank or noise answers always return 0.
    """
    if _is_blank_or_noise(user_answer):
        return 0

    # Quick pre-check: if submission contains no code-like patterns, score 0
    has_code_chars = bool(re.search(
        r"[\(\)\[\]\{\}=:<>]|def |return |print |for |while |if |import |class ",
        user_answer
    ))
    has_only_gibberish = not re.search(r"[a-zA-Z]{2,}", user_answer)
    if has_only_gibberish and not has_code_chars:
        return 0

    prompt = f"""You are a strict but fair code evaluator for a technical interview system.

## Question
{question_text if question_text else "(not provided)"}

## Ideal / Reference Answer
```
{ideal_answer}
```

## Candidate's Answer
```
{user_answer}
```

## Instructions
Score the candidate's answer from 0 to 100 based on:
- Correctness (50 pts): Does the logic produce the right output?
- Completeness (25 pts): Are edge cases and requirements handled?
- Code quality (15 pts): Readable, idiomatic, well-structured?
- Efficiency (10 pts): Reasonable time/space complexity?

Strict rules:
- Blank, random text, or answers completely unrelated to the question -> score MUST be 0.
- Answers with the right idea but minor bugs -> 40-60.
- Answers that are correct but less clean than ideal -> 70-85.
- Perfect or near-perfect -> 90-100.

Respond with ONLY a JSON object in this exact format (no markdown fences, no extra text):
{{"score": <integer 0-100>, "reason": "<one sentence>"}}"""

    try:
        response = httpx.post(
            ANTHROPIC_API_URL,
            headers={"Content-Type": "application/json"},
            json={
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 200,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=20.0,
        )
        data = response.json()
        raw_text = data["content"][0]["text"].strip()
        result = json.loads(raw_text)
        score = int(result.get("score", 0))
        return max(0, min(100, score))

    except Exception:
        # Fallback to keyword overlap if the API call fails
        return calculate_score(user_answer, ideal_answer)