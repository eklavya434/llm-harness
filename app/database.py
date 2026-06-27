import sqlite3
import os
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from app import config

def get_db_connection():
    """Establishes connection to the SQLite database. Creates parent directory if missing."""
    db_path = config.DATABASE_PATH
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes SQLite schema if tables do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Runs Summary Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        pipeline_version TEXT NOT NULL,
        average_faithfulness REAL DEFAULT 0.0,
        average_relevance REAL DEFAULT 0.0,
        average_clarity REAL DEFAULT 0.0,
        average_similarity REAL DEFAULT 0.0,
        sample_count INTEGER DEFAULT 0
    )
    """)

    # 2. Individual Evaluated Samples Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS samples (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        question TEXT NOT NULL,
        retrieved_context TEXT NOT NULL,
        model_output TEXT NOT NULL,
        ground_truth TEXT,
        faithfulness_score INTEGER NOT NULL,
        faithfulness_reason TEXT NOT NULL,
        relevance_score INTEGER NOT NULL,
        relevance_reason TEXT NOT NULL,
        clarity_score INTEGER NOT NULL,
        clarity_reason TEXT NOT NULL,
        semantic_similarity REAL NOT NULL,
        FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
    )
    """)

    # 3. Judge Results Cache Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS judge_cache (
        cache_key TEXT PRIMARY KEY,
        faithfulness_score INTEGER NOT NULL,
        faithfulness_reason TEXT NOT NULL,
        relevance_score INTEGER NOT NULL,
        relevance_reason TEXT NOT NULL,
        clarity_score INTEGER NOT NULL,
        clarity_reason TEXT NOT NULL,
        semantic_similarity REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 4. Create Indexes for optimization
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_judge_cache_key ON judge_cache(cache_key)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_samples_run_id ON samples(run_id)")

    conn.commit()
    conn.close()

def get_cached_evaluation(cache_key: str) -> Optional[Dict[str, Any]]:
    """Fetches a cached judge result for a given hash key if it exists."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT faithfulness_score, faithfulness_reason, relevance_score, relevance_reason, "
        "clarity_score, clarity_reason, semantic_similarity FROM judge_cache WHERE cache_key = ?",
        (cache_key,)
    )
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            "faithfulness_score": row["faithfulness_score"],
            "faithfulness_reason": row["faithfulness_reason"],
            "relevance_score": row["relevance_score"],
            "relevance_reason": row["relevance_reason"],
            "clarity_score": row["clarity_score"],
            "clarity_reason": row["clarity_reason"],
            "semantic_similarity": row["semantic_similarity"]
        }
    return None

def cache_evaluation(cache_key: str, eval_result: Any):
    """Caches a judge result in the SQLite database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT OR REPLACE INTO judge_cache (cache_key, faithfulness_score, faithfulness_reason, "
            "relevance_score, relevance_reason, clarity_score, clarity_reason, semantic_similarity) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                cache_key,
                eval_result.faithfulness.score,
                eval_result.faithfulness.reason,
                eval_result.relevance.score,
                eval_result.relevance.reason,
                eval_result.clarity.score,
                eval_result.clarity.reason,
                eval_result.semantic_similarity
            )
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def save_evaluation_run(pipeline_version: str, evaluated_samples: List[Dict[str, Any]]) -> str:
    """
    Saves a completed evaluation run, computes aggregates, and stores all samples.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    run_id = f"run_{uuid.uuid4().hex[:12]}_{datetime.now().strftime('%m%d_%H%M')}"
    
    # Calculate aggregates
    total_samples = len(evaluated_samples)
    if total_samples > 0:
        avg_faith = sum(s["evaluation"].faithfulness.score for s in evaluated_samples) / total_samples
        avg_rel = sum(s["evaluation"].relevance.score for s in evaluated_samples) / total_samples
        avg_clarity = sum(s["evaluation"].clarity.score for s in evaluated_samples) / total_samples
        avg_sim = sum(s["evaluation"].semantic_similarity for s in evaluated_samples) / total_samples
    else:
        avg_faith = avg_rel = avg_clarity = avg_sim = 0.0

    try:
        # Insert run summary
        cursor.execute(
            "INSERT INTO runs (id, pipeline_version, average_faithfulness, average_relevance, "
            "average_clarity, average_similarity, sample_count, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                run_id,
                pipeline_version,
                round(avg_faith, 2),
                round(avg_rel, 2),
                round(avg_clarity, 2),
                round(avg_sim, 4),
                total_samples,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        )

        # Insert samples
        for s in evaluated_samples:
            sample_id = s.get("id") or f"sample_{uuid.uuid4().hex[:8]}"
            cursor.execute(
                "INSERT INTO samples (id, run_id, question, retrieved_context, model_output, "
                "ground_truth, faithfulness_score, faithfulness_reason, relevance_score, "
                "relevance_reason, clarity_score, clarity_reason, semantic_similarity) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    sample_id,
                    run_id,
                    s["question"],
                    s["retrieved_context"],
                    s["model_output"],
                    s.get("ground_truth"),
                    s["evaluation"].faithfulness.score,
                    s["evaluation"].faithfulness.reason,
                    s["evaluation"].relevance.score,
                    s["evaluation"].relevance.reason,
                    s["evaluation"].clarity.score,
                    s["evaluation"].clarity.reason,
                    s["evaluation"].semantic_similarity
                )
            )
        conn.commit()
        return run_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_all_runs() -> List[Dict[str, Any]]:
    """Retrieves all evaluation runs sorted by creation time."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM runs ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_run_by_id(run_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves run summary and all individual samples evaluated in that run."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
    run_row = cursor.fetchone()
    if not run_row:
        conn.close()
        return None
        
    run_info = dict(run_row)
    
    cursor.execute("SELECT * FROM samples WHERE run_id = ?", (run_id,))
    sample_rows = cursor.fetchall()
    conn.close()
    
    run_info["samples"] = [dict(s) for s in sample_rows]
    return run_info

def get_latest_run_for_version(pipeline_version: str) -> Optional[Dict[str, Any]]:
    """Fetches the latest evaluation run for a specific pipeline version."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM runs WHERE pipeline_version = ? ORDER BY created_at DESC LIMIT 1", (pipeline_version,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    run_info = dict(row)
    
    cursor.execute("SELECT * FROM samples WHERE run_id = ?", (run_info["id"],))
    sample_rows = cursor.fetchall()
    conn.close()
    
    run_info["samples"] = [dict(s) for s in sample_rows]
    return run_info

def get_comparison_report(v1: str, v2: str) -> Dict[str, Any]:
    """
    Compares the latest runs of two pipeline versions (v1 -> v2) to find regressions.
    """
    run_v1 = get_latest_run_for_version(v1)
    run_v2 = get_latest_run_for_version(v2)

    if not run_v1 or not run_v2:
        return {
            "error": f"Runs for version comparison not found. v1 exists: {run_v1 is not None}, v2 exists: {run_v2 is not None}"
        }

    samples_v1 = {s["question"]: s for s in run_v1["samples"]}
    samples_v2 = {s["question"]: s for s in run_v2["samples"]}

    comparisons = []
    improved = 0
    degraded = 0
    unchanged = 0

    for q, s2 in samples_v2.items():
        if q in samples_v1:
            s1 = samples_v1[q]
            
            # Simple score comparisons (Faithfulness + Relevance + Clarity)
            score_v1 = s1["faithfulness_score"] + s1["relevance_score"] + s1["clarity_score"]
            score_v2 = s2["faithfulness_score"] + s2["relevance_score"] + s2["clarity_score"]
            
            diff = score_v2 - score_v1
            if diff > 0:
                improved += 1
                status = "improved"
            elif diff < 0:
                degraded += 1
                status = "degraded"
            else:
                unchanged += 1
                status = "unchanged"

            comparisons.append({
                "question": q,
                "v1_run_id": s1["run_id"],
                "v2_run_id": s2["run_id"],
                "v1_output": s1["model_output"],
                "v2_output": s2["model_output"],
                "v1_scores": {
                    "faithfulness": s1["faithfulness_score"],
                    "relevance": s1["relevance_score"],
                    "clarity": s1["clarity_score"],
                    "similarity": s1["semantic_similarity"]
                },
                "v2_scores": {
                    "faithfulness": s2["faithfulness_score"],
                    "relevance": s2["relevance_score"],
                    "clarity": s2["clarity_score"],
                    "similarity": s2["semantic_similarity"]
                },
                "diff": {
                    "faithfulness": s2["faithfulness_score"] - s1["faithfulness_score"],
                    "relevance": s2["relevance_score"] - s1["relevance_score"],
                    "clarity": s2["clarity_score"] - s1["clarity_score"],
                    "similarity": s2["semantic_similarity"] - s1["semantic_similarity"]
                },
                "status": status
            })

    return {
        "v1_summary": {
            "version": v1,
            "run_id": run_v1["id"],
            "average_faithfulness": run_v1["average_faithfulness"],
            "average_relevance": run_v1["average_relevance"],
            "average_clarity": run_v1["average_clarity"],
            "average_similarity": run_v1["average_similarity"]
        },
        "v2_summary": {
            "version": v2,
            "run_id": run_v2["id"],
            "average_faithfulness": run_v2["average_faithfulness"],
            "average_relevance": run_v2["average_relevance"],
            "average_clarity": run_v2["average_clarity"],
            "average_similarity": run_v2["average_similarity"]
        },
        "metrics": {
            "total_compared": len(comparisons),
            "improved": improved,
            "degraded": degraded,
            "unchanged": unchanged
        },
        "comparisons": comparisons
    }

def get_quota_statistics() -> Dict[str, int]:
    """Gets total cached evaluations vs live calls recorded in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM judge_cache")
    cached_count = cursor.fetchone()[0]
    conn.close()
    return {
        "total_cached_records": cached_count
    }
