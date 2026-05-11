"""Pipeline 2: FAISS vector retrieval + OpenRouter LLM synthesis."""

import json
import time
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from openai import OpenAI
from pipelines.base import BasePipeline, PipelineResult
from config import settings

_SYSTEM = (
    "You are a senior financial analyst. Use ONLY the provided context excerpts "
    "from SEC filings to answer the question. If the answer is not in the context, "
    "say 'Not found in retrieved documents.' Do not hallucinate."
)


class BasicRAGPipeline(BasePipeline):
    name = "basic_rag"

    def __init__(self) -> None:
        self.embedder = SentenceTransformer(settings.EMBED_MODEL)
        self.index = faiss.read_index(settings.FAISS_INDEX_PATH)
        with open(settings.CHUNKS_PATH) as f:
            self.chunks = [json.loads(line) for line in f]
        self.client = OpenAI(
            api_key=settings.OPENROUTER_API_KEY,
            base_url=settings.OPENROUTER_BASE_URL,
        )

    def _retrieve(self, query: str) -> list[str]:
        vec = self.embedder.encode([query], normalize_embeddings=True)
        _, indices = self.index.search(np.array(vec, dtype="float32"), settings.TOP_K)
        return [
            self.chunks[i]["text"]
            for i in indices[0]
            if 0 <= i < len(self.chunks)
        ]

    def run(self, query: str) -> PipelineResult:
        t0 = time.monotonic()
        try:
            chunks = self._retrieve(query)
            context = "\n\n---\n\n".join(chunks)
            user_msg = f"Context from SEC filings:\n{context}\n\nQuestion: {query}"
            resp = self.client.chat.completions.create(
                model=settings.OPENROUTER_MODEL,
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": user_msg},
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
                retrieved_chunks=chunks,
            )
        except Exception as exc:
            return PipelineResult(
                pipeline_name=self.name,
                answer="",
                error=str(exc),
                latency_ms=(time.monotonic() - t0) * 1000,
            )
