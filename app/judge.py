import hashlib
import json
import logging
import os
import time
import random
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

# We use google-genai package for Gemini
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None

import httpx
from app import config

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic schemas for structured LLM responses
class RubricResponse(BaseModel):
    score: int = Field(..., description="Score from 1 to 5 (1 is worst, 5 is best)")
    reason: str = Field(..., description="A concise, one-sentence justification for the score")

class FullEvaluation(BaseModel):
    faithfulness: RubricResponse
    relevance: RubricResponse
    clarity: RubricResponse
    semantic_similarity: float

# Global variables for caching
_embedding_model = None
_seed_cache = None

# Quota usage counter in-memory for reporting/transparency
QUOTA_USAGE = {
    "live_api_calls": 0,
    "cached_hits": 0
}

def get_cache_hash(question: str, context: str, output: str) -> str:
    """Generates a deterministic hash for a sample's inputs to serve as the cache key."""
    text_to_hash = f"{question}|||{context}|||{output}"
    return hashlib.md5(text_to_hash.encode("utf-8")).hexdigest()

def load_seed_cache() -> Dict[str, Any]:
    """Loads the pre-computed judge results from the bundled JSON seed file."""
    global _seed_cache
    if _seed_cache is None:
        seed_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "judge_cache_seed.json")
        if os.path.exists(seed_path):
            try:
                with open(seed_path, "r") as f:
                    _seed_cache = json.load(f)
                logger.info(f"Loaded {len(_seed_cache)} cached evaluations from {seed_path}")
            except Exception as e:
                logger.error(f"Failed to load judge cache seed: {e}")
                _seed_cache = {}
        else:
            logger.warning(f"Judge cache seed file not found at {seed_path}")
            _seed_cache = {}
    return _seed_cache

def calculate_cosine_similarity(text1: str, text2: str) -> float:
    """
    Computes semantic similarity between two texts using sentence-transformers.
    Lazy loads the model to keep imports fast.
    """
    global _embedding_model
    if _embedding_model is None:
        logger.info("Initializing SentenceTransformer('all-MiniLM-L6-v2')...")
        try:
            from sentence_transformers import SentenceTransformer, util
            # CPU execution is forced to conserve memory in free tiers
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
        except Exception as e:
            logger.error(f"Failed to load sentence-transformers model: {e}")
            return 0.0

    try:
        from sentence_transformers import util
        emb1 = _embedding_model.encode(text1, convert_to_tensor=True)
        emb2 = _embedding_model.encode(text2, convert_to_tensor=True)
        similarity = util.cos_sim(emb1, emb2)
        return float(similarity.item())
    except Exception as e:
        logger.error(f"Error calculating cosine similarity: {e}")
        return 0.0

def evaluate_with_gemini(prompt: str) -> Dict[str, Any]:
    """Calls Gemini API using the google-genai SDK, requesting structured JSON output."""
    if not config.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")

    if genai is None:
        raise ImportError("google-genai library is not installed.")

    client = genai.Client(api_key=config.GEMINI_API_KEY)
    
    # Implementing exponential backoff
    max_retries = 3
    backoff_factor = 2.0
    
    for attempt in range(max_retries):
        try:
            # Enforcing structured outputs using response_schema
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=RubricResponse,
                    temperature=0.0, # Zero temperature for deterministic evaluation
                )
            )
            # Parse structured response text
            return json.loads(response.text)
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Gemini API call permanently failed after {max_retries} attempts: {e}")
                raise e
            sleep_time = (backoff_factor ** attempt) + random.uniform(0, 1)
            logger.warning(f"Gemini API call failed (attempt {attempt+1}/{max_retries}): {e}. Retrying in {sleep_time:.2f}s...")
            time.sleep(sleep_time)

def evaluate_with_ollama(prompt: str) -> Dict[str, Any]:
    """Calls local Ollama instance for offline judge evaluations."""
    url = f"{config.OLLAMA_API_BASE}/api/chat"
    payload = {
        "model": config.OLLAMA_MODEL,
        "messages": [
            {
                "role": "system", 
                "content": "You are a precise LLM evaluation judge. You must return structured JSON matching this schema: {\"score\": int, \"reason\": str}."
            },
            {"role": "user", "content": prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.0
        }
    }
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()
            message_content = result["message"]["content"]
            return json.loads(message_content)
    except Exception as e:
        logger.error(f"Ollama call failed: {e}")
        raise e

def run_rubric_evaluation(rubric: str, question: str, context: str, output: str, provider: str = "GEMINI") -> Dict[str, Any]:
    """Formulates prompts and runs evaluation against chosen provider for a specific rubric."""
    if rubric == "FAITHFULNESS":
        prompt = (
            "You are an expert AI judge evaluating a RAG pipeline's response.\n"
            "Your task is to evaluate the Faithfulness of the response relative to the retrieved context.\n"
            "Faithfulness definition: The response should contain only information directly supported by the context. "
            "Any claims not mentioned or contradicting the context must result in a lower score.\n\n"
            f"Retrieved Context: {context}\n"
            f"Model Output Response: {output}\n\n"
            "Evaluate and return structured JSON matching the schema."
        )
    elif rubric == "RELEVANCE":
        prompt = (
            "You are an expert AI judge evaluating a RAG pipeline's response.\n"
            "Your task is to evaluate the Relevance of the response relative to the user's question.\n"
            "Relevance definition: The response should directly address the user's question and be useful. "
            "It should not contain irrelevant or off-topic information.\n\n"
            f"User Question: {question}\n"
            f"Model Output Response: {output}\n\n"
            "Evaluate and return structured JSON matching the schema."
        )
    elif rubric == "CLARITY":
        prompt = (
            "You are an expert AI judge evaluating a RAG pipeline's response.\n"
            "Your task is to evaluate the Clarity of the response.\n"
            "Clarity definition: The response should be easy to understand, well-structured, coherent, "
            "and free of grammatical errors or confusing jargon.\n\n"
            f"Model Output Response: {output}\n\n"
            "Evaluate and return structured JSON matching the schema."
        )
    else:
        raise ValueError(f"Unknown evaluation rubric: {rubric}")

    # Provider Dispatch
    if provider == "GEMINI":
        return evaluate_with_gemini(prompt)
    elif provider == "OLLAMA":
        return evaluate_with_ollama(prompt)
    else:
        raise ValueError(f"Unsupported judge provider: {provider}")

def evaluate_sample(question: str, context: str, output: str, provider: Optional[str] = None) -> FullEvaluation:
    """
    Main evaluation pipeline for a single sample.
    Checks the local JSON / database cache first. If cache miss, invokes LLM judge.
    """
    global QUOTA_USAGE
    if provider is None:
        provider = config.JUDGE_PROVIDER
        
    cache_key = get_cache_hash(question, context, output)
    
    # 1. Check local JSON cache (in-memory)
    seed_cache = load_seed_cache()
    if cache_key in seed_cache:
        logger.info(f"Cache HIT for key {cache_key} (JSON cache)")
        QUOTA_USAGE["cached_hits"] += 1
        cached_data = seed_cache[cache_key]
        return FullEvaluation(
            faithfulness=RubricResponse(score=cached_data["faithfulness_score"], reason=cached_data["faithfulness_reason"]),
            relevance=RubricResponse(score=cached_data["relevance_score"], reason=cached_data["relevance_reason"]),
            clarity=RubricResponse(score=cached_data["clarity_score"], reason=cached_data["clarity_reason"]),
            semantic_similarity=cached_data["semantic_similarity"]
        )

    # 2. Check Database cache (only if db functions are initialized and we import them)
    try:
        from app.database import get_cached_evaluation
        db_cached = get_cached_evaluation(cache_key)
        if db_cached:
            logger.info(f"Cache HIT for key {cache_key} (Database cache)")
            QUOTA_USAGE["cached_hits"] += 1
            return FullEvaluation(
                faithfulness=RubricResponse(score=db_cached["faithfulness_score"], reason=db_cached["faithfulness_reason"]),
                relevance=RubricResponse(score=db_cached["relevance_score"], reason=db_cached["relevance_reason"]),
                clarity=RubricResponse(score=db_cached["clarity_score"], reason=db_cached["clarity_reason"]),
                semantic_similarity=db_cached["semantic_similarity"]
            )
    except Exception as e:
        # If DB import or execution fails (e.g. during standalone tests), skip DB caching
        pass

    # 3. Cache Miss: Run Evaluation using LLM Judges
    logger.info(f"Cache MISS for key {cache_key}. Querying judge {provider}...")
    QUOTA_USAGE["live_api_calls"] += 1
    
    # Faithfulness
    try:
        faithfulness_res = run_rubric_evaluation("FAITHFULNESS", question, context, output, provider)
    except Exception as e:
        logger.error(f"Error evaluating Faithfulness: {e}")
        faithfulness_res = {"score": 1, "reason": f"Evaluation failed: parse_error ({str(e)[:50]})"}

    # Relevance
    try:
        relevance_res = run_rubric_evaluation("RELEVANCE", question, context, output, provider)
    except Exception as e:
        logger.error(f"Error evaluating Relevance: {e}")
        relevance_res = {"score": 1, "reason": f"Evaluation failed: parse_error ({str(e)[:50]})"}

    # Clarity
    try:
        clarity_res = run_rubric_evaluation("CLARITY", question, context, output, provider)
    except Exception as e:
        logger.error(f"Error evaluating Clarity: {e}")
        clarity_res = {"score": 1, "reason": f"Evaluation failed: parse_error ({str(e)[:50]})"}

    # Semantic similarity (Question vs Model Output) using sentence-transformers
    sem_similarity = calculate_cosine_similarity(question, output)
    
    evaluation = FullEvaluation(
        faithfulness=RubricResponse(**faithfulness_res),
        relevance=RubricResponse(**relevance_res),
        clarity=RubricResponse(**clarity_res),
        semantic_similarity=sem_similarity
    )
    
    # Write to database cache if possible
    try:
        from app.database import cache_evaluation
        cache_evaluation(cache_key, evaluation)
        logger.info(f"Saved evaluation result to database cache under key {cache_key}")
    except Exception as e:
        pass

    return evaluation

if __name__ == "__main__":
    # Dry run evaluation for test verification
    print("Starting Standalone Judge Test...")
    test_q = "What is the return policy for clearance sale?"
    test_c = "Clearance items with a yellow tag can be returned for store credit only within 14 days. Red tag is final sale."
    test_o = "You can return clearance items with yellow tags within 14 days to get store credit."
    
    # Should result in a cache hit if it was generated in the seed cache, let's verify
    res = evaluate_sample(test_q, test_c, test_o)
    print("\n--- Evaluation Results ---")
    print(json.dumps(res.model_dump(), indent=2))
    print("\n--- Quota Usage Stats ---")
    print(json.dumps(QUOTA_USAGE, indent=2))
