import json
import sqlite3
from contextlib import contextmanager

@contextmanager
def connect(path):
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    try:
        with db:
            yield db
    finally:
        db.close()

def initialize(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS detections (
          id TEXT PRIMARY KEY, created_at TEXT NOT NULL, boxes TEXT NOT NULL,
          width INTEGER NOT NULL, height INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS potholes (
          id TEXT PRIMARY KEY, latitude REAL NOT NULL, longitude REAL NOT NULL,
          description TEXT NOT NULL, source TEXT NOT NULL, detection_id TEXT,
          status TEXT NOT NULL DEFAULT 'reported', created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL, resolution_note TEXT);
        CREATE INDEX IF NOT EXISTS potholes_status ON potholes(status);
        ''')

def detection_row(row):
    item = dict(row)
    item['boxes'] = json.loads(item['boxes'])
    return item
