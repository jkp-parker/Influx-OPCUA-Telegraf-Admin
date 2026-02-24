FROM python:3.11-slim

WORKDIR /app

# System deps for asyncua and cryptography packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Persistent volume for SQLite database
VOLUME ["/app/data"]

ENV DATABASE_URL=sqlite:////app/data/opcua_admin.db

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
