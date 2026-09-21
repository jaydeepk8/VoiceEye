FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 \
        libegl1 \
        libgles2 \
        libglib2.0-0 \
        libgomp1 \
        libxcb1 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-server.txt .
RUN pip install --no-cache-dir -r requirements-server.txt

COPY ml/landmarks.py ml/live.py ml/download_models.py ./ml/
COPY ml/checkpoints/sign_gru.onnx ml/checkpoints/sign_gru.meta.json ./ml/checkpoints/
COPY server/ ./server/

RUN python ml/download_models.py

RUN python -c "import sys, numpy as np; sys.path.insert(0, 'ml'); \
from landmarks import LandmarkExtractor; \
e = LandmarkExtractor(video_mode=True); \
f = e.extract(np.zeros((240, 320, 3), np.uint8), 0); \
e.close(); \
print('extractor ok, features', f.vector.shape)"

EXPOSE 8000

CMD ["sh", "-c", "uvicorn server.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
