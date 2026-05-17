#!/bin/sh
exec uvicorn dashboard.backend.main:app --host 0.0.0.0 --port "${PORT:-8000}"
