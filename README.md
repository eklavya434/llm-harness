---
title: llm-eval-harness-api
emoji: 🔍
colorFrom: blue
colorTo: gray
sdk: docker
app_port: 7860
---

# LLM Evaluation & Observability Harness (API Backend)

A portfolio-grade LLM evaluation and observability platform designed to automatically evaluate the output quality of LLM/RAG pipelines (inspired by tools like RAGAS, DeepEval, and Langfuse).

## Key Features

- **Provider-Agnostic LLM Judge**: Evaluates Faithfulness, Relevance, and Clarity using Gemini (google-genai) as primary judge, with an Ollama fallback strategy.
- **Strict JSON Structured Output**: Utilizes Gemini's schema validation to return deterministic, structured evaluation scores and rationales.
- **Zero-Cost Deployment Caching**: Implements a dual-layer SQLite + JSON cache to ensure pre-seeded demonstration data runs at zero API cost.
- **Ephemerality Resilience**: Automatically repopulates the SQLite database in the ephemeral `/tmp/` directory on container startup.
- **RAG Semantic Embeddings**: Measures cosine similarity using a local CPU-optimized `sentence-transformers/all-MiniLM-L6-v2` model.

## Architecture

- **Backend**: FastAPI (Python), SQLite database, sentence-transformers, Google GenAI SDK. Deployed on Hugging Face Spaces (Docker SDK).
- **Frontend**: Next.js (App Router), Tailwind CSS, Recharts. Deployed on Vercel.

## Local Setup

### Prerequisites
- Python 3.10+
- (Optional) Ollama with `llama3` loaded for local offline evaluation.

### Installation
1. Clone the repository.
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` and fill in the required variables:
   ```bash
   cp .env.example .env
   ```
5. Run the DB seeding script:
   ```bash
   python seed_db.py
   ```
6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 7860
   ```

## Ephemeral Storage Note (Hugging Face Spaces)
Because Hugging Face Spaces container restarts completely wipe the storage (with `/tmp` being the only writable directory), this project packages cached judge results and samples inside `data/` and automatically imports them on startup. This allows recruiters and interviewers to run evaluation comparison demos instantly without incurring API costs.
