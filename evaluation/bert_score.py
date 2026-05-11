"""BERTScore wrapper — thread-safe, single-threaded torch to avoid uvicorn conflicts."""

from typing import Optional

_model_type = "roberta-large"


def compute_bertscore(candidate: str, reference: str) -> Optional[float]:
    if not candidate or not reference:
        return None
    try:
        import torch
        torch.set_num_threads(1)
        from bert_score import score as _score  # type: ignore
        with torch.no_grad():
            _, _, f1 = _score(
                [candidate],
                [reference],
                model_type=_model_type,
                lang="en",
                verbose=False,
                nthreads=1,
            )
        return round(float(f1[0]), 4)
    except TypeError:
        # Older bert_score versions don't have nthreads
        try:
            import torch
            from bert_score import score as _score  # type: ignore
            with torch.no_grad():
                _, _, f1 = _score([candidate], [reference], lang="en", verbose=False)
            return round(float(f1[0]), 4)
        except Exception:
            return None
    except Exception:
        return None


def warm_up() -> None:
    pass  # Lazy loading — model loads on first query call
