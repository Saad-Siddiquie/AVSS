# AVSS Face Recognition Fine-Tuning Guide

## Models Used in AVSS

| Module | Model | Purpose | Size |
|--------|-------|---------|------|
| 7 — Face Detection | OpenCV DNN (ResNet-SSD) | Find face bounding boxes | ~3 MB |
| 8 — Face Recognition | InsightFace ArcFace (buffalo_l) | Generate 512-dim embeddings | ~500 MB |
| 12 — Tracking | ByteTrack (supervision) | Consistent person IDs across frames | No weights |

---

## Do You Even Need to Fine-Tune?

**No fine-tuning needed if:**
- Faces are clear and well-lit
- Subjects face the camera directly
- You just want to find a specific person by uploading their photo

**Fine-tuning helps if:**
- Faces are partially occluded (masks, caps, sunglasses)
- Very low-resolution CCTV footage (<480p)
- Long distances from camera (faces appear very small)

---

## Fine-Tuning Pipeline

### Step 1 — Collect face crops

From photos of a person:
```bash
python training/prepare_dataset.py \
  --mode images \
  --input_dir /path/to/photos \
  --output_dir training/data \
  --person_name "Ahmed Ali"
```

From a video of a person:
```bash
python training/prepare_dataset.py \
  --mode video \
  --input_dir /path/to/video.mp4 \
  --output_dir training/data \
  --person_name "Ahmed Ali" \
  --max_crops 150
```

Repeat for each person. Minimum 20 crops, recommended 50-200.

Your `training/data/` should look like:
```
training/data/
  Ahmed_Ali/
    frame000010_1200ms_face00.jpg
    frame000030_2400ms_face00.jpg
    ...
  Saad_Siddiqui/
    img_001_face00.jpg
    ...
```

### Step 2 — Fine-tune

```bash
cd backend
python training/finetune_arcface.py \
  --data_dir training/data \
  --output_dir training/output \
  --epochs 20 \
  --batch_size 16 \
  --lr 0.001
```

This trains for 20 epochs and saves:
- `training/output/best_backbone.pth` — PyTorch weights
- `training/output/avss_arcface.onnx` — ONNX model for inference
- `training/output/identity_map.json` — maps class index → person name

### Step 3 — Use your trained model

```bash
export AVSS_USE_PRETRAINED_FACE=false
export AVSS_CUSTOM_FACE_WEIGHTS=/full/path/to/training/output/avss_arcface.onnx
uvicorn app.main:app --reload --port 8002
```

Or add to your `.env` file:
```
AVSS_USE_PRETRAINED_FACE=false
AVSS_CUSTOM_FACE_WEIGHTS=training/output/avss_arcface.onnx
```

---

## What the Training Does (Simplified)

```
Input: Face photo (112×112 pixels)
        ↓
  ResNet-50 backbone
        ↓
  512-dimensional embedding vector
        ↓
  ArcFace Loss:
    "Make the same person's embeddings close together (cos > 0.5)"
    "Push different people's embeddings apart (cos < 0.3)"
        ↓
  After training: model knows your specific people better
```

### ArcFace vs Softmax
Standard softmax just classifies "which person is this?"
ArcFace adds an angular margin (default 0.5 radians) that forces
the model to be MORE confident — embeddings of the same person
must be very similar, not just "more similar than wrong ones".

---

## Requirements for Fine-Tuning

```bash
pip install torch torchvision onnx tqdm
```

GPU strongly recommended for training (CPU works but is ~10x slower).

---

## Expected Results

| Scenario | InsightFace (default) | After Fine-Tuning |
|----------|----------------------|-------------------|
| Clear frontal face | 95%+ accuracy | 97%+ |
| Side profile | 70-80% | 85-90% |
| Face with mask | 40-60% | 70-80% |
| Low resolution | 50-70% | 65-80% |

Fine-tuning on 50 images per person typically improves accuracy
by 10-20% on challenging footage.
