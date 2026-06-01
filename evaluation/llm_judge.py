"""LLM-as-a-Judge: returns (pass: bool, reason: str) for a candidate answer."""

from typing import Optional
from openai import OpenAI
from config import settings

# With reference — compare candidate against known-good answer
_PROMPT_WITH_REF = """You are a strict financial analyst evaluating an AI-generated answer.

Question: {question}
Reference answer: {reference}
Candidate answer: {candidate}

Does the candidate correctly and completely address the question, consistent with the reference?
Reply with exactly two lines:
VERDICT: PASS or FAIL
REASON: one sentence explaining why."""

# Without reference — judge factuality and relevance on their own
_PROMPT_NO_REF = """You are a strict financial analyst. Evaluate whether this AI-generated answer is:
1. Directly relevant to the question
2. Factually reasonable (no obvious hallucinations)
3. Specific enough to be useful (not just vague generalities)

Question: {question}
Answer: {candidate}

Reply with exactly two lines:
VERDICT: PASS or FAIL
REASON: one sentence explaining why."""


def llm_judge(
    question: str,
    candidate: str,
    reference: Optional[str] = None,
) -> tuple[Optional[bool], Optional[str]]:
    if not candidate or not candidate.strip():
        return None, None
    try:
        client = OpenAI(
            api_key=settings.active_api_key,
            base_url=settings.active_base_url,
        )
        if reference and reference.strip():
            prompt = _PROMPT_WITH_REF.format(
                question=question, reference=reference, candidate=candidate
            )
        else:
            prompt = _PROMPT_NO_REF.format(question=question, candidate=candidate)

        resp = client.chat.completions.create(
            model=settings.active_judge_model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0,
        )
        text = resp.choices[0].message.content or ""
        lines = text.strip().splitlines()
        verdict_line = next((l for l in lines if "VERDICT" in l.upper()), "")
        reason_line  = next((l for l in lines if "REASON"  in l.upper()), "")
        passed = "PASS" in verdict_line.upper()
        reason = reason_line.split(":", 1)[-1].strip() or None
        return passed, reason
    except Exception as e:
        return None, f"Judge error: {e}"
