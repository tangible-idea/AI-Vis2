#!/bin/sh
# Boot markers print at every step so an empty runtime log means the
# platform never ran this container at all.
set -e

echo "[entrypoint] container is up (uid=$(id -u))"
if [ -r /sys/fs/cgroup/memory.max ]; then
    echo "[entrypoint] memory limit: $(cat /sys/fs/cgroup/memory.max)"
fi

echo "[entrypoint] starting Xvfb on :99"
Xvfb :99 -screen 0 1280x900x24 -nolisten tcp &
export DISPLAY=:99

# Honor a platform-injected $PORT (Cloud Run, Render, Railway, App Runner…),
# falling back to 8100 for plain `docker run`.
PORT="${PORT:-8100}"
echo "[entrypoint] starting uvicorn on 0.0.0.0:${PORT}"
exec uvicorn server:app --host 0.0.0.0 --port "${PORT}"
