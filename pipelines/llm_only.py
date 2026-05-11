"""Pipeline 1: Raw prompt → OpenRouter LLM. No retrieval."""

import time
from openai import OpenAI
from pipelines.base import BasePipeline, PipelineResult
from config import settings

_SYSTEM = (
    "You are a senior financial analyst with deep knowledge of SEC filings, "
    "earnings calls, and public company disclosures. Answer questions clearly "
    "and cite specific figures where possible."
)


class LLMOnlyPipeline(BasePipeline):
    name = "llm_only"

    def __init__(self) -> None:
        self.client = OpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=settings.OPENROUTER_BASE_URL,
        )

    def run(self, query: str) -> PipelineResult:
        t0 = time.monotonic()
        try:
            resp = self.client.chat.completions.create(
                model=settings.OPENROUTER_MODEL,
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": query},
                ],
            )
            latency_ms = (time.monotonic() - t0) * 1000
            usage = resp.usage
            return PipelineResult(
                pipeline_name=self.name,
                answer=resp.choices[0].message.content or "",
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
                latency_ms=latency_ms,
                cost_usd=self._estimate_cost(
                    settings.OPENROUTER_MODEL,
                    usage.prompt_tokens,
                    usage.completion_tokens,
                ),
            )
        except Exception as exc:
            return PipelineResult(
                pipeline_name=self.name,
                answer="",
                error=str(exc),
                latency_ms=(time.monotonic() - t0) * 1000,
            )
