import json
import os
import sys
from datetime import datetime

# Setup PYTHONPATH
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import (
    init_db, 
    get_db_connection, 
    save_evaluation_run, 
    get_all_runs
)
from app.judge import evaluate_sample

def seed():
    print("================== DATABASE SEEDING START ==================")
    
    # 1. Initialize SQLite Database Schema
    print("Initializing Database schema...")
    init_db()
    
    # Check if runs already exist
    runs = get_all_runs()
    if len(runs) > 0:
        print(f"Database already contains {len(runs)} runs. Skipping seeding.")
        return

    # 2. Populate Judge Cache
    cache_path = os.path.join(os.path.dirname(__file__), "data", "judge_cache_seed.json")
    if not os.path.exists(cache_path):
        print(f"Error: Judge cache seed file not found at {cache_path}")
        return
        
    print(f"Loading judge cache seeds from {cache_path}...")
    with open(cache_path, "r") as f:
        cache_data = json.load(f)

    conn = get_db_connection()
    cursor = conn.cursor()
    
    inserted_cache_count = 0
    for cache_key, entry in cache_data.items():
        try:
            cursor.execute(
                "INSERT OR REPLACE INTO judge_cache (cache_key, faithfulness_score, faithfulness_reason, "
                "relevance_score, relevance_reason, clarity_score, clarity_reason, semantic_similarity) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    cache_key,
                    entry["faithfulness_score"],
                    entry["faithfulness_reason"],
                    entry["relevance_score"],
                    entry["relevance_reason"],
                    entry["clarity_score"],
                    entry["clarity_reason"],
                    entry["semantic_similarity"]
                )
            )
            inserted_cache_count += 1
        except Exception as e:
            print(f"Failed to insert cache key {cache_key}: {e}")
            
    conn.commit()
    print(f"Successfully loaded {inserted_cache_count} cached evaluations into 'judge_cache' table.")

    # 3. Create Seeded Evaluation Runs
    samples_path = os.path.join(os.path.dirname(__file__), "data", "samples_seed.json")
    if not os.path.exists(samples_path):
        print(f"Error: Samples seed file not found at {samples_path}")
        conn.close()
        return

    print(f"Loading sample datasets from {samples_path}...")
    with open(samples_path, "r") as f:
        samples = json.load(f)

    # Group samples by pipeline version
    runs_by_version = {}
    for s in samples:
        version = s["pipeline_version"]
        if version not in runs_by_version:
            runs_by_version[version] = []
        runs_by_version[version].append(s)

    # Evaluate and save each run
    # Since we populated the DB cache above, all evaluate_sample calls will HIT the cache instantly.
    for version, version_samples in sorted(runs_by_version.items()):
        print(f"Processing run for pipeline version: {version} ({len(version_samples)} samples)...")
        evaluated_list = []
        
        for s in version_samples:
            eval_res = evaluate_sample(
                question=s["question"],
                context=s["retrieved_context"],
                output=s["model_output"]
            )
            
            evaluated_list.append({
                "id": s["id"],
                "question": s["question"],
                "retrieved_context": s["retrieved_context"],
                "model_output": s["model_output"],
                "ground_truth": s.get("ground_truth"),
                "evaluation": eval_res
            })

        # Save evaluation run will write both run metadata and individual sample details
        run_id = save_evaluation_run(version, evaluated_list)
        print(f"Saved run {run_id} for version {version}.")

    conn.close()
    print("================== DATABASE SEEDING COMPLETED ==================")

if __name__ == "__main__":
    seed()
