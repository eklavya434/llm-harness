from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import config
from app.routes import router as api_router
from app.database import init_db

# Initialize FastAPI app
app = FastAPI(
    title="LLM Evaluation & Observability Harness API",
    description="Backend API for evaluating LLM/RAG pipeline outputs",
    version="1.0.0"
)

# Startup event to ensure DB tables are created
@app.on_event("startup")
def startup_event():
    init_db()

# Configure CORS to allow access from the Next.js frontend
allowed_origins = [config.ALLOWED_ORIGIN] if config.ALLOWED_ORIGIN != "*" else ["*"]
if "*" in allowed_origins:
    allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include endpoints router
app.include_router(api_router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "judge_provider": config.JUDGE_PROVIDER,
        "database_path": config.DATABASE_PATH
    }
