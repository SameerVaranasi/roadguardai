import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from app.main import create_app

class FakeDetector:
    def predict(self, image, confidence):
        return [{'class_id': 0, 'label': 'pothole', 'confidence': 0.8, 'xyxy': [1, 2, 8, 9]}]

@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path/'test.db', FakeDetector(), api_key='')) as c:
        yield c

def test_lifecycle_and_alerts(client):
    assert client.get('/health').json()['database'] == 'connected'
    body = {'latitude':16.5, 'longitude':80.5, 'description':'Demo hazard'}
    r = client.post('/api/potholes', json=body)
    assert r.status_code == 201
    ident = r.json()['id']
    query = '?latitude=16.5&longitude=80.5&radius_m=50'
    assert client.get('/api/alerts/nearby'+query).json()['items'] == []
    assert client.patch(f'/api/potholes/{ident}/status', json={'status':'confirmed','note':'Checked manually on site'}).status_code == 200
    assert len(client.get('/api/alerts/nearby'+query).json()['items']) == 1
    assert client.get('/api/alerts/nearby?latitude=0&longitude=0').json()['items'] == []
    assert client.patch(f'/api/potholes/{ident}/status', json={'status':'resolved','note':'Repair independently verified'}).status_code == 200
    assert client.get('/api/alerts/nearby'+query).json()['items'] == []
    assert client.patch(f'/api/potholes/{ident}/status', json={'status':'confirmed','note':'Try reopening'}).status_code == 409
    assert client.get('/api/potholes?status=resolved').json()['total'] == 1

def test_validation(client):
    assert client.post('/api/potholes', json={'latitude':91,'longitude':0}).status_code == 422
    assert client.post('/api/potholes', json={'latitude':0,'longitude':0,'source':'model'}).status_code == 422
    assert client.get('/api/detections/missing').status_code == 404
    assert client.get('/api/alerts/nearby?latitude=NaN&longitude=0').status_code == 422
    assert client.get('/api/potholes?limit=0').status_code == 422
    assert client.patch('/api/potholes/missing/status', json={'status':'resolved','note':'Checked manually'}).status_code == 404

def test_upload_and_link(client):
    data = io.BytesIO()
    Image.new('RGB', (16,16)).save(data, format='PNG')
    r = client.post('/api/detections', files={'file':('test.png',data.getvalue(),'image/png')})
    assert r.status_code == 201
    ident = r.json()['id']
    assert client.get('/api/detections/'+ident).json()['boxes'][0]['label'] == 'pothole'
    assert client.post('/api/potholes', json={'latitude':0,'longitude':0,'source':'model','detection_id':ident}).status_code == 201
    assert client.post('/api/detections', files={'file':('bad.png',b'not an image','image/png')}).status_code == 400
    assert client.post('/api/detections', files={'file':('large.png',b'x'*(10*1024*1024+1),'image/png')}).status_code == 413

def test_persistence_and_auth(tmp_path):
    path = tmp_path/'persistent.db'
    with TestClient(create_app(path, FakeDetector(), api_key='secret')) as c:
        assert c.get('/api/potholes').status_code == 401
        assert c.post('/api/potholes', headers={'X-API-Key':'secret'}, json={'latitude':0,'longitude':0}).status_code == 201
    with TestClient(create_app(path, FakeDetector(), api_key='secret')) as c:
        assert c.get('/api/potholes',headers={'X-API-Key':'secret'}).json()['total'] == 1
        assert c.get('/api/potholes',headers={'X-API-Key':'wrong'}).status_code == 401

def test_missing_model(tmp_path, monkeypatch):
    monkeypatch.setenv('MODEL_PATH',str(tmp_path/'missing.pt'))
    data = io.BytesIO()
    Image.new('RGB',(5,5)).save(data, format='PNG')
    with TestClient(create_app(tmp_path/'db.sqlite', api_key='')) as c:
        assert c.get('/health').json()['model_file_present'] is False
        assert c.post('/api/detections',files={'file':('test.png',data.getvalue(),'image/png')}).status_code == 503

def test_cors(client):
    r = client.options('/api/potholes',headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'POST'})
    assert r.headers['access-control-allow-origin'] == 'http://localhost:5173'
