# Validation performed

Six pytest tests passed using Python 3.12 in the build environment.

- Report creation, confirmation, nearby filtering and resolution
- Coordinate/pagination validation and missing records
- JPEG/PNG upload flow with a fake detector, stored result and linked report
- Rejected invalid/oversized uploads
- SQLite persistence across application restarts and API-key enforcement
- Missing model returns 503; configured frontend CORS works

Real model weights were not supplied to this build environment. CUDA inference
and Windows execution must be verified on your laptop after copying your weights.
The backend uses Python syntax compatible with Python 3.13.

The test runner emitted one Starlette/httpx deprecation warning; all tests passed.
