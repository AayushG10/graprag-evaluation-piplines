from dataclasses import dataclass, field
from typing import Optional

# Cost per 1M tokens (prompt, completion) — update as needed
_PRICING: dict[str, tuple[float, float]] = {
    "meta-llama/llama-3.1-70b-instruct": (0.59, 0.79),
    "meta-llama/llama-3.1-8b-instruct":  (0.055, 0.055),
    "mistralai/Mistral-7B-Instruct-v0.3": (0.055, 0.055),
    "google/gemini-flash-1.5":            (0.075, 0.30),
    "openai/gpt-4o-mini":                 (0.15, 0.60),
    "openai/gpt-4o":                      (5.00, 15.00),
}
_DEFAULT_PRICING = (1.0, 1.0)


@dataclass
class PipelineResult:
    pipeline_name: str
    answer: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    retrieved_chunks: list[str] = field(default_factory=list)
    graph_hops: int = 0
    bertscore_f1: Optional[float] = None
    judge_pass: Optional[bool] = None
    judge_reason: Optional[str] = None
    error: Optional[str] = None


class BasePipeline:
    name: str = "base"

    def run(self, query: str) -> PipelineResult:
        raise NotImplementedError

    def _estimate_cost(self, model: str, prompt_tokens: int, completion_tokens: int) -> float:
        p_price, c_price = _PRICING.get(model, _DEFAULT_PRICING)
        return (prompt_tokens * p_price + completion_tokens * c_price) / 1_000_000
