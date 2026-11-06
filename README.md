# RoadGuard AI — Training & Comparing 16 Machine Learning Models

**A software-focused computer vision and machine learning project for pothole detection.**

**GitHub:** https://github.com/SameerVaranasi/roadguardai

RoadGuard AI explores 16 machine learning and deep learning approaches for recognizing potholes in road imagery. The goal is to build a reproducible training and evaluation workflow, compare suitable models, and identify candidates for integration into a road-hazard detection application.

> **Model integrity:** These 16 entries do **not** all implement the original detection architectures. Classical ML methods and the transfer-learning CNNs are **image classifiers**. YOLO11n is a real object detector. The entries named *Faster R-CNN Lite*, *SSD Lite*, *RetinaNet Lite*, and *Mask R-CNN Lite* are **simplified proxy architectures**, not faithful implementations of their namesakes. Report their results under those names, not as benchmarks for the original papers' models.
>
> **Implementation note:** This README updates the *software documentation*, not the training code. The commands below assume the training script has been named `scripts/train_16_models.py`, its dependencies are listed in `requirements.txt`, and output paths / device settings have been updated as needed. Rename and adapt the actual files before running these commands.

## 1. Project objectives

- Prepare and validate a pothole image dataset.
- Train classical ML, convolutional neural network, and object-detection approaches.
- Compare models using task-appropriate metrics and reproducible data splits.
- Save trained weights, logs, and evaluation results.
- Select practical models for integration with a software-based detection workflow.

## 2. Technologies

| Area | Technologies |
| --- | --- |
| Programming | Python |
| Classical machine learning | scikit-learn, XGBoost |
| Deep learning | PyTorch / Ultralytics, TensorFlow / Keras (as used by the training script) |
| Image processing | OpenCV, Pillow, HOG features |
| Data handling | NumPy, pandas, YAML |
| Evaluation | Accuracy, precision, recall, F1-score, mAP@50 |
| Visualization | Matplotlib |
| Development environment | Windows, Linux, or Google Colab |

The exact libraries and versions must match the actual implementations in the repository.

## 3. Proposed project structure

```text
roadguard_model_benchmark/
├── scripts/
│   └── train_16_models.py         # model training and evaluation entry point
├── configs/
│   └── data.example.yaml          # example dataset configuration
├── requirements.txt               # desktop / Colab Python dependencies
├── outputs/                       # created during execution
│   ├── results.csv
│   ├── comparison_chart.png
│   ├── training_log.txt
│   ├── weights/
│   └── exports/
└── README.md
```

**Note:** This is the desired software-oriented layout. Only the README has been rewritten here; these filenames and folders must be present in the real repository for the commands to work.

## 4. Models included

| # | Model | Type | General approach |
| --- | --- | --- | --- |
| 1 | Random Forest | Image classification | HOG features + PCA + Random Forest |
| 2 | Support Vector Machine | Image classification | HOG features + PCA + RBF SVM |
| 3 | Decision Tree | Image classification | HOG features + PCA + Decision Tree |
| 4 | K-Nearest Neighbors | Image classification | HOG features + PCA + KNN |
| 5 | Logistic Regression | Image classification | HOG features + PCA + Logistic Regression |
| 6 | XGBoost | Image classification | HOG features + PCA + gradient-boosted trees |
| 7 | AdaBoost | Image classification | HOG features + PCA + AdaBoost |
| 8 | Custom CNN | Image classification | Lightweight convolutional network |
| 9 | ResNet-50 | Image classification | Transfer learning with a classification head |
| 10 | MobileNetV2 | Image classification | Transfer learning with a classification head |
| 11 | EfficientNet-B0 | Image classification | Transfer learning with a classification head |
| 12 | YOLO11n | Object detection | Ultralytics YOLO11n fine-tuning |
| 13 | Faster R-CNN Lite | Proxy detection | Simplified MobileNet-based detector; **not Faster R-CNN** |
| 14 | SSD Lite | Proxy detection | Simplified MobileNet-based detection head; **not full SSD** |
| 15 | RetinaNet Lite | Proxy detection | Simplified detector using focal loss; **not RetinaNet** |
| 16 | Mask R-CNN Lite | Proxy / experimental | Simplified model with a mask-related head; **not Mask R-CNN** |

The dataset shown below has **bounding boxes**, not ground-truth segmentation masks. A valid instance-segmentation evaluation would require appropriate mask annotations; do not describe proxy mask outputs as verified instance segmentation.

## 5. Dataset preparation

The project uses a pothole dataset in **YOLO annotation format**.

```text
RoadGuard-Potholes/
├── train/
│   ├── images/
│   └── labels/
├── valid/
│   ├── images/
│   └── labels/
├── test/
│   ├── images/
│   └── labels/
└── data.yaml
```

Example `data.yaml`:

```yaml
path: /absolute/path/to/RoadGuard-Potholes
train: train/images
val: valid/images
test: test/images
nc: 1
names: ['pothole']
```

Update `path` to the actual location on your computer or Colab session.

**For classification models:** Convert the detection annotations to image-level labels using a documented rule, for example *pothole present* if an image contains at least one pothole bounding box, otherwise *no pothole*. Use the training split for fitting preprocessing such as PCA, then apply the same transformation to validation/test images. Do not mix data across splits.

**For detectors:** Use the original image and bounding-box annotations. Assess detection quality using detection metrics, not just image-level accuracy.

## 6. Set up the Python environment

### Windows (PowerShell)

```powershell
cd roadguard_model_benchmark
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Linux / macOS

```bash
cd roadguard_model_benchmark
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Google Colab

Upload or clone the project and make the dataset accessible within the session. Install dependencies in the notebook:

```bash
!pip install -r requirements.txt
```

For GPU acceleration, install versions of the deep learning frameworks compatible with your system and available accelerator. **The original script may force CPU execution**; update its training configuration if GPU use is intended. GPU availability alone does not guarantee every model will run on it.

## 7. Train and evaluate the models

### Run the full benchmark

```bash
python scripts/train_16_models.py \
  --data /absolute/path/to/RoadGuard-Potholes/data.yaml \
  --time-budget 270 \
  --max-train-images 400 \
  --max-val-images 120
```

`--time-budget 270` is a **requested time limit in minutes**, not a promise that all 16 models will finish in 4.5 hours. Actual runtime depends on CPU/GPU, dataset size, software versions, and the training script's time-limit handling.

### Run selected groups

```bash
# Classical ML classifiers
python scripts/train_16_models.py --data /path/to/data.yaml --models classifiers

# CNN classifiers
python scripts/train_16_models.py --data /path/to/data.yaml --models cnn

# Detection models and experimental proxies
python scripts/train_16_models.py --data /path/to/data.yaml --models detectors

# Named models
python scripts/train_16_models.py --data /path/to/data.yaml \
  --models random_forest,xgboost,mobilenetv2,yolo11n
```

These examples use the command-line options documented for the original training script. Check `python scripts/train_16_models.py --help` after updating the script to confirm that the options are supported.

## 8. Evaluation and fair comparisons

| Model task | Useful metrics | Interpretation |
| --- | --- | --- |
| Image classification | Accuracy, precision, recall, F1-score | Is a pothole present anywhere in the image? |
| Object detection | mAP@50, precision, recall | Where are the potholes, and how well do predicted boxes match annotations? |
| Experimental proxy detection | Metric supported by the proxy's actual output/labels | Not equivalent to the corresponding full detection architecture |

**Important:** Do not place classifier F1-scores and detection mAP values on a single ranking chart as if they were the same metric. Report them in separate groups or explicitly label the axes and metric types. Also record train/validation/test sizes, confidence thresholds, preprocessing, and evaluation settings.

An existing RoadGuard YOLO result has been reported as **66.7% mAP@50**. Treat that as a separately reported result until the exact dataset split, weights, and evaluation procedure are matched to the benchmark run.

## 9. Output artifacts

Depending on what the training script actually implements, a run may produce:

| Output | Purpose |
| --- | --- |
| `outputs/results.csv` | Per-model status, metrics, execution time, and notes |
| `outputs/comparison_chart.png` | Visual comparison within compatible model tasks |
| `outputs/training_log.txt` | Training progress, warnings, and failures |
| `outputs/weights/` | Saved model weights or serialized classifiers |
| `outputs/exports/` | Optional deployment exports, when supported |

**Export limitations:** A `.keras` classifier may be convertible to TFLite with an appropriate input pipeline. A scikit-learn pickle is **not** a TFLite model, and YOLO exports require their own supported conversion workflow. Do not assume every model can be automatically exported as `.tflite` or that outputs share the same inference interface.

## 10. Connecting the selected model to RoadGuard

After evaluating models:

1. Choose a model appropriate for the feature: classification for image-level warnings, detection for pothole locations.
2. Save and version its weights alongside preprocessing and class labels.
3. Implement an inference module that accepts an image or video frame.
4. Connect predictions to the RoadGuard application's API or road-hazard workflow.
5. Validate detection quality and inference latency on representative road videos.

A classifier predicts whether an image contains a pothole; it does **not** produce bounding boxes unless additional localization logic is implemented.

## 11. Troubleshooting

- **Out-of-memory errors:** Reduce batch size, image resolution, or sample count; run models separately.
- **Slow training:** Use a supported GPU configuration, smaller experiments, or pretrained feature extractors.
- **Missing modules:** Check the active Python environment and `requirements.txt`.
- **Dataset path errors:** Confirm paths in `data.yaml` and verify images/labels exist.
- **Unexpected model metrics:** Validate split integrity, input preprocessing, threshold settings, and label conversion.
- **Export failures:** Confirm the selected model framework supports the requested export format.

## 12. Project status and transparency

This repository describes a **16-approach experimental benchmark** for RoadGuard AI. The listed models are approaches to be trained and evaluated; a row in the README does not establish that training completed successfully. Publish actual metrics from `results.csv` only after verifying the corresponding runs. Keep the lightweight proxy detector results separate from results for the original architectures.

---

**RoadGuard AI** · Machine Learning · Computer Vision · Model Benchmarking · Python
