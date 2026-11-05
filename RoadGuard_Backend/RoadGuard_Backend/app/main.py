import io
import json
import math
import os
import secrets
import warnings
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool
from .database import connect, detection_row, initialize
from .detector import Detector

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')
Image.MAX_IMAGE_PIXELS = 20_000_000

def now():
    return datetime.now(timezone.utc).isoformat()

def distance_m(lat1, lon1, lat2, lon2):
    a, b = math.radians(lat1), math.radians(lat2)
    dlat, dlon = b-a, math.radians(lon2-lon1)
    h = math.sin(dlat/2)**2 + math.cos(a)*math.cos(b)*math.sin(dlon/2)**2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))

class Report(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    description: str = Field(default='', max_length=1000)
    source: Literal['manual', 'model'] = 'manual'
    detection_id: str | None = None

class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: Literal['confirmed', 'resolved']
    note: str = Field(min_length=5, max_length=1000)

def create_app(db_path=None, detector=None, api_key=None):
    db_path = Path(db_path or os.getenv('DATABASE_PATH', str(ROOT/'data'/'roadguard.db')))
    if not db_path.is_absolute():
        db_path = ROOT / db_path
    model_path = Path(os.getenv('MODEL_PATH', str(ROOT/'models'/'RoadGuard_YOLO11n_Laptop.pt')))
    if not model_path.is_absolute():
        model_path = ROOT / model_path
    detector = detector or Detector(model_path, os.getenv('MODEL_DEVICE', '0'))
    key = os.getenv('API_KEY', '') if api_key is None else api_key

    @asynccontextmanager
    async def lifespan(app):
        initialize(db_path)
        yield

    app = FastAPI(title='RoadGuard Backend', version='1.0.0', lifespan=lifespan,
                  description='Local research prototype. Image predictions are not confirmed hazards. Coordinates must be supplied by a user/device.')
    origins = [v.strip() for v in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000').split(',') if v.strip()]
    app.add_middleware(CORSMiddleware, allow_origins=origins,
                       allow_methods=['GET', 'POST', 'PATCH'], allow_headers=['Content-Type', 'X-API-Key'])
    header = APIKeyHeader(name='X-API-Key', auto_error=False)

    def authorize(value=Depends(header)):
        if key and (not value or not secrets.compare_digest(value, key)):
            raise HTTPException(401, 'Invalid or missing X-API-Key')

    protected = [Depends(authorize)]

    @app.get('/health')
    def health():
        with connect(db_path) as db:
            db.execute('SELECT 1')
        return {'status': 'ok', 'database': 'connected', 'model_file_present': model_path.is_file()}

    @app.post('/api/detections', dependencies=protected, status_code=201)
    async def detect(file: UploadFile = File(...), confidence: float = Query(0.25, ge=0.01, le=1)):
        try:
            payload = await file.read(10 * 1024 * 1024 + 1)
        finally:
            await file.close()
        if len(payload) > 10 * 1024 * 1024:
            raise HTTPException(413, 'Image must be at most 10 MiB')
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(payload)) as original:
                    if original.format not in ('JPEG', 'PNG'):
                        raise HTTPException(415, 'Use JPEG or PNG images')
                    original.load()
                    image = ImageOps.exif_transpose(original).convert('RGB')
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise HTTPException(400, 'Invalid or oversized image')
        try:
            boxes = await run_in_threadpool(detector.predict, image, confidence)
        except FileNotFoundError as exc:
            raise HTTPException(503, str(exc))
        except Exception:
            import logging
            logging.exception('Model inference failed')
            raise HTTPException(503, 'Model inference failed; check server console and MODEL_DEVICE')
        item = dict(id=str(uuid4()), created_at=now(), boxes=boxes, width=image.width, height=image.height)
        with connect(db_path) as db:
            db.execute('INSERT INTO detections VALUES (?,?,?,?,?)',
                       (item['id'], item['created_at'], json.dumps(boxes), image.width, image.height))
        return item

    @app.get('/api/detections/{detection_id}', dependencies=protected)
    def get_detection(detection_id: str):
        with connect(db_path) as db:
            row = db.execute('SELECT * FROM detections WHERE id=?', (detection_id,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Detection not found')
        return detection_row(row)

    @app.post('/api/potholes', dependencies=protected, status_code=201)
    def report(body: Report):
        stamp, ident = now(), str(uuid4())
        with connect(db_path) as db:
            if body.source == 'model' and not body.detection_id:
                raise HTTPException(422, 'Model reports require detection_id')
            if body.detection_id:
                row = db.execute('SELECT * FROM detections WHERE id=?', (body.detection_id,)).fetchone()
                if row is None:
                    raise HTTPException(404, 'Detection not found')
                if not any(b['label'].lower() == 'pothole' for b in json.loads(row['boxes'])):
                    raise HTTPException(422, 'Referenced detection has no pothole predictions')
            db.execute('INSERT INTO potholes VALUES (?,?,?,?,?,?,?,?,?,?)',
                       (ident, body.latitude, body.longitude, body.description, body.source,
                        body.detection_id, 'reported', stamp, stamp, None))
            row = db.execute('SELECT * FROM potholes WHERE id=?', (ident,)).fetchone()
        return dict(row)

    @app.get('/api/potholes', dependencies=protected)
    def potholes(status: Literal['reported', 'confirmed', 'resolved'] | None = None,
                 limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
        with connect(db_path) as db:
            clause, args = (' WHERE status=?', [status]) if status else ('', [])
            total = db.execute('SELECT COUNT(*) FROM potholes'+clause, args).fetchone()[0]
            rows = db.execute('SELECT * FROM potholes'+clause+' ORDER BY created_at DESC LIMIT ? OFFSET ?', args+[limit, offset]).fetchall()
        return {'total': total, 'items': [dict(r) for r in rows]}

    @app.get('/api/alerts/nearby', dependencies=protected)
    def nearby(latitude: float = Query(ge=-90, le=90, allow_inf_nan=False),
               longitude: float = Query(ge=-180, le=180, allow_inf_nan=False),
               radius_m: float = Query(100, gt=0, le=5000, allow_inf_nan=False)):
        with connect(db_path) as db:
            rows = db.execute("SELECT * FROM potholes WHERE status='confirmed'").fetchall()
        items = []
        for row in rows:
            d = distance_m(latitude, longitude, row['latitude'], row['longitude'])
            if d <= radius_m:
                items.append(dict(row) | {'distance_m': round(d, 2)})
        return {'items': sorted(items, key=lambda x:x['distance_m']),
                'scope': 'Radial proximity only; does not determine road, direction, or lane.'}

    @app.patch('/api/potholes/{pothole_id}/status', dependencies=protected)
    def update_status(pothole_id: str, body: StatusUpdate):
        if not body.note.strip():
            raise HTTPException(422, 'Provide a meaningful confirmation note')
        with connect(db_path) as db:
            row = db.execute('SELECT * FROM potholes WHERE id=?', (pothole_id,)).fetchone()
            if row is None:
                raise HTTPException(404, 'Pothole not found')
            if row['status'] == 'resolved':
                raise HTTPException(409, 'Resolved reports cannot be changed; submit a new observation')
            db.execute('UPDATE potholes SET status=?, resolution_note=?, updated_at=? WHERE id=?',
                       (body.status, body.note, now(), pothole_id))
            row = db.execute('SELECT * FROM potholes WHERE id=?', (pothole_id,)).fetchone()
        return dict(row)

    return app

app = create_app()
