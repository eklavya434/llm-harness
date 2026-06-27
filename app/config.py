import os
from dotenv import load_dotenv

# Load environment variables from .env file for local development
load_dotenv()

# Database setup
DATABASE_PATH = os.getenv("DATABASE_PATH", "/tmp/eval.db")

# LLM API configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
JUDGE_PROVIDER = os.getenv("JUDGE_PROVIDER", "GEMINI").upper()

# Ollama settings (fallback)
OLLAMA_API_BASE = os.getenv("OLLAMA_API_BASE", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

# CORS and API exposure settings
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")
