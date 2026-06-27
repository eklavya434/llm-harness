FROM python:3.10-slim

# Create user appuser with UID 1000 (recommended by HF Spaces)
RUN useradd -m -u 1000 appuser

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

WORKDIR /app

# Install basic system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app

# Change ownership of /app files to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the default Hugging Face Spaces port
EXPOSE 7860

# Run seeder and start FastAPI server
CMD ["sh", "-c", "python seed_db.py && uvicorn app.main:app --host 0.0.0.0 --port 7860"]
