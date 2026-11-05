from pathlib import Path
from threading import Lock

class Detector:
    def __init__(self, model_path, device='0'):
        self.path = Path(model_path)
        self.device = device
        self.model = None
        self.lock = Lock()

    def predict(self, image, confidence):
        # Serialize model loading/inference: one model instance on the laptop GPU.
        with self.lock:
            if not self.path.is_file():
                raise FileNotFoundError('Copy RoadGuard_YOLO11n_Laptop.pt into models/ or set MODEL_PATH in .env')
            if self.model is None:
                from ultralytics import YOLO
                self.model = YOLO(str(self.path))
            result = self.model.predict(image, device=self.device, imgsz=416,
                                        conf=confidence, verbose=False)[0]
            return [dict(class_id=int(b.cls.item()), label=result.names[int(b.cls.item())],
                         confidence=float(b.conf.item()), xyxy=b.xyxy[0].tolist())
                    for b in result.boxes]
