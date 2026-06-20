FROM python:3.11-slim

WORKDIR /app

# System deps for Pillow (image processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    libopenjp2-7 \
    libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

# Python deps (cached layer)
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# Source
COPY backend/ /app/backend/
COPY companion/ /app/companion/

# Persistent uploads directory (mounted by docker-compose)
RUN mkdir -p /app/backend/uploads

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
