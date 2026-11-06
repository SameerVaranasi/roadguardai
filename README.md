# RoadGuard — Train 16 Models on Raspberry Pi 3 (1GB RAM)

Lightweight, memory-aware training script that trains all 16 algorithms from your
project on a Raspberry Pi 3 within a ~4.5-hour budget.

> **Honesty note:** Pi 3 has 1GB RAM and 1.4GHz CPU. Heavy detectors (Faster R-CNN,
> Mask R-CNN, RetinaNet) cannot realistically be trained in their full form on Pi 3.
> This package substitutes **lite versions** (MobileNet backbones + a small detection
> head) for the four heaviest detectors. They train and produce metrics, but they
> are approximations, not the original papers' models. YOLO11n uses the real
> Ultralytics implementation with batch=2, imgsz=160, CPU only.

---

## 0) What this package contains

```
roadguard_pi_training/
├── scripts/
│   └── train_16_models_pi.py     # main training script
├── configs/
│   └── data.example.yaml         # YOLO dataset config template
├── requirements-pi.txt           # Python deps (Pi 3 friendly)
└── README_PI.md                  # this file
```

## 1) One-time Pi 3 setup (about 30 min)

### a) Increase swap to 4GB (otherwise large models OOM)

```bash
sudo nano /etc/dphys-swapfile
#   CONF_SWAPSIZE=4096
sudo systemctl restart dphys-swapfile
free -h   # check Swap row shows ~4.0Gi
```

### b) Reduce GPU memory split (give RAM back to CPU)

```bash
sudo raspi-config
# Performance Options → GPU Memory → 16
sudo reboot
```

### c) Install 64-bit Raspberry Pi OS (REQUIRED)

The TF/torch wheels below only work on **64-bit** Pi OS (Bookworm or Bullseye).
Run `uname -m` — it should say `aarch64`. If it says `armv7l`, reinstall with the
**64-bit** Raspberry Pi OS image.

### d) System packages

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip python3-dev build-essential \
                    libopenblas-dev libhdf5-dev libjpeg-dev zlib1g-dev \
                    libpq-dev pkg-config git
```

### e) Create venv + install

```bash
cd ~/roadguard_pi_training
python3 -m venv venv --system-site-packages
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements-pi.txt
```

> **TF install on Pi 3 takes ~20 min and ~700 MB disk.** Plan accordingly.
> If `tensorflow-cpu==2.15.1` install fails, try `pip install tensorflow-aarch64`
> or use the system-provided `python3-tensorflow` apt package on Bookworm.

## 2) Prepare your dataset

Your existing `RoadGuard-Potholes` dataset is already in YOLO format. Just point
the script at its `data.yaml`. Example layout:

```
~/datasets/RoadGuard-Potholes/
├── train/images/*.jpg
├── train/labels/*.txt
├── valid/images/*.jpg
├── valid/labels/*.txt
├── test/images/*.jpg
├── test/labels/*.txt
└── data.yaml
```

Edit `data.yaml` so paths are absolute on the Pi:

```yaml
# data.yaml
path: /home/pi/datasets/RoadGuard-Potholes
train: train/images
val: valid/images
test: test/images
nc: 1
names: ['pothole']
```

A copy of this template is in `configs/data.example.yaml`.

## 3) Run the full 16-model training (4.5 hours)

```bash
cd ~/roadguard_pi_training
source venv/bin/activate
python3 scripts/train_16_models_pi.py \
    --data /home/pi/datasets/RoadGuard-Potholes/data.yaml \
    --time-budget 270 \
    --max-train-images 400 \
    --max-val-images 120
```

Recommended: run inside `tmux` so SSH disconnects don't kill the job:

```bash
sudo apt install -y tmux
tmux new -s rg
# (run the python command above)
# Ctrl-B then d to detach;  tmux attach -t rg  to reattach
```

## 4) Run only a subset (faster iteration)

```bash
# Only the 7 classical models (~35 min)
python3 scripts/train_16_models_pi.py --data <path> --models classifiers

# Only the 4 CNN transfer-learning models (~90 min)
python3 scripts/train_16_models_pi.py --data <path> --models cnn

# Only detectors (YOLO11n + 4 lite variants, ~130 min)
python3 scripts/train_16_models_pi.py --data <path> --models detectors

# Specific subset
python3 scripts/train_16_models_pi.py --data <path> \
    --models random_forest,xgboost,mobilenetv2,yolo11n
```

## 5) Outputs

After the run finishes (or crashes), look in `outputs_pi/`:

| File | Description |
|------|-------------|
| `results.csv` | One row per model: status, accuracy/precision/recall/F1, mAP@50 (detectors), epochs, time used, notes. **Incrementally written** — safe even if Pi reboots mid-run. |
| `comparison_chart.png` | Horizontal bar chart of F1/mAP for all trained models. |
| `training_log.txt` | Full text log with timestamps and memory usage. |
| `weights/` | Saved `.keras` files for trained CNNs/detectors; sklearn pickles for classical. |
| `exports/` | TFLite versions of the **top 3** models by F1/mAP — drop-in for Pi inference. |

## 6) Time & memory budget per model (Pi 3 1GB)

| # | Model | Approach | Budget (min) | Notes |
|---|---|---|---|---|
| 1 | Random Forest | HOG+PCA → sklearn RF | 5 | 50 trees |
| 2 | SVM | HOG+PCA → RBF SVC | 8 | cache_size=200 |
| 3 | Decision Tree | HOG+PCA → DTree | 3 | depth 10 |
| 4 | KNN | HOG+PCA → k=5 | 3 | brute force |
| 5 | Logistic Reg | HOG+PCA → LR | 3 | max_iter 500 |
| 6 | XGBoost | HOG+PCA → XGB | 8 | hist method |
| 7 | AdaBoost | HOG+PCA → Ada | 5 | 50 weak learners |
| 8 | CNN custom | 3-conv tiny CNN | 25 | batch=16 |
| 9 | ResNet-50 | Frozen + head | 25 | batch=2 |
| 10 | MobileNetV2 | Frozen + head | 20 | batch=4 |
| 11 | EfficientNet-B0 | Frozen + head | 20 | batch=2 |
| 12 | YOLO11n | Ultralytics finetune | 35 | batch=2, imgsz=160, CPU |
| 13 | Faster R-CNN lite | MobileNetV3Small + 1-stage head | 25 | batch=2 |
| 14 | SSD lite | MobileNetV2 + 1-stage head | 20 | batch=4 |
| 15 | RetinaNet lite | MobileNetV2 + focal-loss head | 25 | batch=2 |
| 16 | Mask R-CNN lite | MobileNetV3Small + mask head | 25 | batch=1 |

**Total: 240 min training + 15 min feat-extract + 15 min eval/export ≈ 270 min (4.5 h)**

If you change `--time-budget`, all per-model budgets scale proportionally.

## 7) What to expect on Pi 3 (honest expectations)

- **Classical models (1-7):** Will finish easily, well within budget. Accuracies
  typically 70–85% on HOG features.
- **CNN transfer (8-11):** Will train but slowly — ~1 epoch/min. Frozen backbones
  keep RAM ~600 MB peak.
- **YOLO11n (12):** Will train but slowly. If it OOMs even at batch=1, run with
  `--models classifiers,cnn` to skip it. On Pi 3 expect ~3-5 epochs in 35 min.
- **Lite detectors (13-16):** Will train ~5-10 epochs each. They are
  approximations, not full Faster R-CNN / Mask R-CNN. Their purpose is to give
  you comparable detection metrics within the Pi's hardware limits.

## 8) If a model crashes

The script catches per-model exceptions and **continues** to the next model. The
crashed model is logged as `crashed` in `results.csv` with a short error note.
The crash does NOT kill the run.

## 9) Re-running / resuming

The script always overwrites `results.csv` per run. To preserve a previous run,
rename the file first:

```bash
mv outputs_pi/results.csv outputs_pi/results_run1.csv
```

## 10) After training — deploying on Pi

The top 3 models are auto-exported to `outputs_pi/exports/*.tflite`. To run
inference with TFLite on the Pi:

```python
import tflite_runtime.interpreter as tflite
import numpy as np
from PIL import Image

interp = tflite.Interpreter(model_path="outputs_pi/exports/mobilenetv2.tflite")
interp.allocate_tensors()
in_d = interp.get_input_details()[0]
out_d = interpreter.get_output_details()[0]

img = Image.open("test.jpg").convert("L").resize((160, 160))
arr = np.asarray(img, dtype=np.float32) / 255.0
arr = np.stack([arr]*3, -1)[None]   # (1,160,160,3)
interp.set_tensor(in_d["index"], arr)
interp.invoke()
score = float(interp.get_tensor(out_d["index"])[0, 0])
print("pothole" if score > 0.5 else "normal", f"{score:.3f}")
```

For TFLite runtime: `pip install tflite-runtime` (much smaller than full TF).

---

**Need help?** Check `outputs_pi/training_log.txt` — every step is timestamped
with current memory usage so you can see exactly where things went wrong.
