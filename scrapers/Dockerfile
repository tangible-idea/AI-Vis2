# AI Visibility Scraper — FastAPI + Playwright in one image.
#
# Build (from the scrapers/ directory):
#   docker build -t ai-vis-scraper .
#
# Run — mount .userdata so login sessions persist across containers:
#   docker run -p 8100:8100 -v "$PWD/.userdata:/app/.userdata" ai-vis-scraper
#
# Login must be done OUTSIDE the container (the browser window has to be
# visible): run `python scrape.py --engine chatgpt --login` on the host,
# then mount the resulting .userdata directory as shown above.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Chromium + its OS deps, plus xvfb: the scraper prefers a headed browser
# (headless=False), which needs a display — xvfb-run provides a virtual one.
RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb \
    && playwright install --with-deps chromium \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# Chromium won't run sandboxed as root — use an unprivileged user.
RUN useradd -m scraper \
    && mkdir -p /app/.userdata \
    && chown -R scraper:scraper /app ${PLAYWRIGHT_BROWSERS_PATH}
USER scraper

VOLUME ["/app/.userdata"]
EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8100/health')" || exit 1

CMD ["xvfb-run", "-a", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8100"]
