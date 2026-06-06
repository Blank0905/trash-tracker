FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# 容器時區設台灣，讓所有 datetime.now() 都回台灣時間（slim 預設無 OS tzdata，需一併安裝）
ENV TZ=Asia/Taipei

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn cryptography

COPY backend/ .
COPY database/ ./database/
RUN ln -s /app/database /database

EXPOSE 8000

# 單一 worker：背景排程器(到站推播/ETL)只能在一個程序跑，否則每筆通知會被多推一次。
# 並發改用多執行緒(--threads)，對這種 I/O 為主(DB / LINE API)的服務足夠。
CMD ["gunicorn", "-w", "1", "--threads", "8", "-b", "0.0.0.0:8000", "run:app"]
