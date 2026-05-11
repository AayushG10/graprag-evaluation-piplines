from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenRouter
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-70b-instruct"
    JUDGE_MODEL: str = "openai/gpt-4o-mini"

    # Embeddings
    EMBED_MODEL: str = "all-MiniLM-L6-v2"
    EMBED_DIMENSION: int = 384

    # FAISS
    FAISS_INDEX_PATH: str = "data/processed/faiss.index"
    CHUNKS_PATH: str = "data/processed/chunks.jsonl"
    TOP_K: int = 5

    # TigerGraph
    USE_SAVANNA: bool = True
    TIGERGRAPH_HOST: str = "localhost"
    TIGERGRAPH_PORT: int = 14240
    TIGERGRAPH_USERNAME: str = "tigergraph"
    TIGERGRAPH_PASSWORD: str = "tigergraph"
    TIGERGRAPH_GRAPH_NAME: str = "FinanceGraph"
    TIGERGRAPH_SECRET: str = ""
    TIGERGRAPH_TOKEN: str = ""   # pre-fetched token (skips secret-based auth)

    # GraphRAG service
    GRAPHRAG_SERVICE_URL: str = "http://localhost:8080"
    GRAPHRAG_QUERY_ENDPOINT: str = "/query"

    # SEC ingestion
    SEC_DATA_DIR: str = "data/raw"
    PROCESSED_DIR: str = "data/processed"
    FILING_YEARS: str = "2019,2020,2021,2022,2023"
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
