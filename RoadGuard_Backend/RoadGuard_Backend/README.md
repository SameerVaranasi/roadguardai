# RoadGuard FastAPI backend

A local backend for your RoadGuard website: SQLite database, YOLO image inference,
manual/model-linked pothole reporting, confirmation/resolution, and proximity alerts.
No retraining needed. Your model weights and dataset are NOT included.

## Windows setup (your existing GPU environment)

1. Extract this ZIP. You should see `RoadGuard_Backend/app/main.py`.
2. Keep using your existing Command Prompt showing `(.venv)`; it already has CUDA
   PyTorch and Ultralytics. Change directory to the extracted `RoadGuard_Backend`.
   Example (adjust if extracted elsewhere):

```bat
cd /d C:\Users\nalam\Downloads\RoadGuard_Backend
python -m pip install -r requirements.txt
copy .env.example .env
copy "C:\Users\nalam\Downloads\RoadGuard_YOLO11n_Laptop.pt" "models\RoadGuard_YOLO11n_Laptop.pt"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

3. Open http://127.0.0.1:8000/docs to try the API. This is an interactive API
   explorer, not the final website. Health: http://127.0.0.1:8000/health.
4. The SQLite file is created automatically at `data/roadguard.db` on startup.
   No MySQL/PostgreSQL/SQLAlchemy installation is required; this project uses
   Python's built-in sqlite3 driver and parameterized queries.
5. Stop with Ctrl+C. Restart with the same command; records persist.

If your terminal no longer shows `(.venv)`, activate the environment BEFORE
changing directory:

```bat
call "C:\Users\nalam\OneDrive\Desktop\ecs\RoadGuard_GPU_Project\RoadGuard_GPU_Project\.venv\Scripts\activate.bat"
```

For a completely new environment, install CUDA PyTorch suitable for your driver
first, then `python -m pip install -r requirements-model.txt`. Do not replace your
working GPU environment unnecessarily. `MODEL_DEVICE=cpu` in `.env` enables CPU
inference. Model is loaded lazily on first upload; database endpoints work without it.
Only load your own trusted model checkpoint.

## Files

- `app/main.py`: validation, API endpoints, CORS and API key checks
- `app/database.py`: SQLite initialization and per-request connections
- `app/detector.py`: lazy YOLO loading with serialized inference
- `.env.example`: model path, database path, frontend origins, optional key
- `frontend-example.js`: fetch helpers for your future frontend
- `tests/test_api.py`: API, persistence, validation and upload tests
- `requirements*.txt`: backend, optional model, and testing dependencies
- `start_backend.bat`: starts locally using the currently active Python

## API contract

All `/api/*` endpoints accept `X-API-Key` when API_KEY is set in `.env`.
`/health`, `/docs`, `/openapi.json` remain public for local diagnostics.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /health | API/database readiness and model-file presence |
| POST | /api/detections | Multipart `file` JPEG/PNG; optional `confidence` query, default 0.25 |
| GET | /api/detections/{id} | Saved detection result including pixel bounding boxes |
| POST | /api/potholes | Report supplied location, optionally linked to detection |
| GET | /api/potholes | List, optional status, limit (1–500) and offset |
| PATCH | /api/potholes/{id}/status | Manually confirm or resolve, with note |
| GET | /api/alerts/nearby | Confirmed hazards within radius of supplied latitude/longitude |

### First database test in Swagger

Expand POST `/api/potholes`, click Try it out, and use these **demo coordinates**:

```json
{"latitude":16.5,"longitude":80.5,"description":"Demo report only","source":"manual"}
```

Copy the returned `id`. Use PATCH `/api/potholes/{id}/status` with:

```json
{"status":"confirmed","note":"Manually confirmed for this demo"}
```

Call GET `/api/alerts/nearby` with latitude=16.5, longitude=80.5 and radius_m=100.
The report should appear. Then PATCH to `resolved` with a verification note and
repeat the alert request: it should no longer appear.

### Image detection to database workflow

1. POST an image to `/api/detections`. It saves prediction metadata, not the image.
   Response contains id, created_at, width, height and boxes. Each box has label,
   class_id, confidence, xyxy. Coordinates refer to the EXIF-oriented image in pixels.
2. Display boxes in your frontend for review. A confidence score is not accuracy.
3. To record a location, POST `/api/potholes` with source `model`, the returned
   `detection_id`, latitude, longitude and description. The server checks the detection
   exists and has a pothole prediction. Report initially has status `reported`.
4. A human confirms the report through PATCH. Only `confirmed` reports generate
   nearby alerts. Resolve only after independent evidence of repair/clear road.

Coordinates are supplied by browser GPS/device GPS or manually for demos. The API
cannot locate a pothole from image pixels and does not use IP location. The camera's
GPS is only an approximate observation location, not precise pothole coordinates.
No auto-clear on a missed prediction. No automatic deduplication: repeated reports
are separate records and require review. Status notes are the latest note, not a full
audit log. Resolved records are terminal; new observations get new reports.

### Website connection

Import `frontend-example.js`. Default API base URL is http://127.0.0.1:8000.
Allow your frontend's exact origin in CORS_ORIGINS (restart backend after changing).
Swagger documents request/response bodies. An OpenAPI snapshot is included too.
Frontend helpers throw useful errors for non-2xx responses.

For a phone/another car, localhost refers to THAT device. You would use the laptop's
LAN IP instead, set API_KEY, allow the intended frontend origin, and bind to
`--host 0.0.0.0`. Do not embed a private shared API key in a publicly shipped frontend.
This starter has no per-user accounts/roles. Keep it local; add proper user auth,
HTTPS, reverse-proxy body/rate limits, backups, migrations and access controls before
internet deployment. API-key mode is a simple trusted-device demo boundary only.
A hosted HTTPS website also needs a reachable HTTPS API, not a localhost HTTP URL.

## Scope and limitations

This ZIP implements the backend, not a finished website, WebSocket push service,
RC-car firmware, route matching, or 16-model training. Poll the nearby endpoint for
now. Radius alerts are straight-line proximity, not necessarily hazards ahead or on
the same road. SQLite is intended for a single laptop prototype with one Uvicorn
worker; use a server database and migrations as concurrency grows. Images are
limited to 10 MiB and 20 megapixels; inference calls are serialized. JSON metadata
is retained across restarts. Raw uploaded images are discarded.

Your previously reported test mAP@50 (58.6%) belongs to your supplied model run, not
a new benchmark performed by this backend. Detection still needs human review.

## Tests

```bat
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Tests use a fake detector and temporary databases. They do not measure real YOLO
accuracy or verify CUDA on your laptop. Run a real image upload after copying your
weights to verify model integration.

## References

- https://fastapi.tiangolo.com/tutorial/request-files/
- https://fastapi.tiangolo.com/tutorial/testing/
- https://docs.ultralytics.com/modes/predict/
