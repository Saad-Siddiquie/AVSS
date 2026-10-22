"""
AVSS Training Data Preparation
================================
Extracts and aligns face crops from your images or video footage.
Output is ready for finetune_arcface.py.

USAGE — From images:
  python training/prepare_dataset.py \
    --mode images \
    --input_dir /path/to/raw_photos \
    --output_dir training/data \
    --person_name "Ahmed Ali"

  This will:
    1. Detect faces in every image in input_dir
    2. Align each face to 112x112 (InsightFace standard)
    3. Save crops to training/data/Ahmed_Ali/

USAGE — From video:
  python training/prepare_dataset.py \
    --mode video \
    --input_dir /path/to/video.mp4 \
    --output_dir training/data \
    --person_name "Ahmed Ali" \
    --max_crops 100

  This will extract up to 100 face crops from the video.

RUN THIS FOR EACH PERSON, then run finetune_arcface.py.
"""

import argparse
import logging
from pathlib import Path

import cv2
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger(__name__)


def align_face(img_bgr: np.ndarray, x1: int, y1: int, x2: int, y2: int,
               output_size: int = 112, padding: float = 0.2) -> np.ndarray:
    """
    Crop and resize a face with padding to output_size × output_size.
    The padding ensures we capture enough context around the face.
    """
    h, w = img_bgr.shape[:2]
    fw = x2 - x1
    fh = y2 - y1
    pad_x = int(fw * padding)
    pad_y = int(fh * padding)

    x1p = max(0, x1 - pad_x)
    y1p = max(0, y1 - pad_y)
    x2p = min(w, x2 + pad_x)
    y2p = min(h, y2 + pad_y)

    crop = img_bgr[y1p:y2p, x1p:x2p]
    if crop.size == 0:
        return None
    return cv2.resize(crop, (output_size, output_size))


def load_face_detector():
    """Load the same OpenCV DNN face detector used by the AVSS pipeline."""
    from pathlib import Path
    import urllib.request

    weights_dir = Path("weights")
    weights_dir.mkdir(exist_ok=True)
    proto = weights_dir / "deploy.prototxt"
    model = weights_dir / "res10_300x300_ssd_iter_140000.caffemodel"

    if not proto.exists():
        logger.info("Downloading face detector prototxt...")
        urllib.request.urlretrieve(
            "https://raw.githubusercontent.com/opencv/opencv/master/"
            "samples/dnn/face_detector/deploy.prototxt",
            str(proto),
        )
    if not model.exists():
        logger.info("Downloading face detector model (~2.7 MB)...")
        urllib.request.urlretrieve(
            "https://github.com/opencv/opencv_3rdparty/raw/"
            "dnn_samples_face_detector_20170830/"
            "res10_300x300_ssd_iter_140000.caffemodel",
            str(model),
        )

    net = cv2.dnn.readNetFromCaffe(str(proto), str(model))
    logger.info("Face detector loaded.")
    return net


def detect_faces(net, frame: np.ndarray, conf_threshold: float = 0.5):
    """Returns list of (x1, y1, x2, y2) face bounding boxes."""
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(
        cv2.resize(frame, (300, 300)), 1.0, (300, 300), (104, 177, 123)
    )
    net.setInput(blob)
    dets = net.forward()
    boxes = []
    for i in range(dets.shape[2]):
        conf = float(dets[0, 0, i, 2])
        if conf < conf_threshold:
            continue
        box = dets[0, 0, i, 3:7] * np.array([w, h, w, h])
        x1, y1, x2, y2 = box.astype(int)
        if x2 - x1 < 30 or y2 - y1 < 30:
            continue
        boxes.append((x1, y1, x2, y2))
    return boxes


def process_images(net, input_dir: Path, output_dir: Path, max_crops: int):
    """Extract face crops from all images in input_dir."""
    saved = 0
    for img_path in sorted(input_dir.iterdir()):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
            continue
        frame = cv2.imread(str(img_path))
        if frame is None:
            continue
        boxes = detect_faces(net, frame)
        for i, (x1, y1, x2, y2) in enumerate(boxes):
            crop = align_face(frame, x1, y1, x2, y2)
            if crop is None:
                continue
            out_path = output_dir / f"{img_path.stem}_face{i:02d}.jpg"
            cv2.imwrite(str(out_path), crop)
            saved += 1
            if saved >= max_crops:
                return saved
    return saved


def process_video(net, video_path: Path, output_dir: Path, max_crops: int):
    """Extract face crops from a video file."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    # Sample every Nth frame to get diverse crops
    step = max(1, total_frames // (max_crops * 3))

    saved = 0
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % step == 0:
            boxes = detect_faces(net, frame)
            for i, (x1, y1, x2, y2) in enumerate(boxes):
                crop = align_face(frame, x1, y1, x2, y2)
                if crop is None:
                    continue
                ts_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                out_path = output_dir / f"frame{frame_idx:06d}_{int(ts_ms)}ms_face{i:02d}.jpg"
                cv2.imwrite(str(out_path), crop)
                saved += 1
                if saved >= max_crops:
                    cap.release()
                    return saved
        frame_idx += 1

    cap.release()
    return saved


def main():
    parser = argparse.ArgumentParser(description="Prepare face training data for AVSS")
    parser.add_argument("--mode", choices=["images", "video"], required=True)
    parser.add_argument("--input_dir", required=True, help="Folder of images or path to video file")
    parser.add_argument("--output_dir", default="training/data", help="Root output directory")
    parser.add_argument("--person_name", required=True, help="Name of the person (becomes folder name)")
    parser.add_argument("--max_crops", type=int, default=100, help="Maximum face crops to save")
    parser.add_argument("--conf_threshold", type=float, default=0.5)
    args = parser.parse_args()

    # Sanitise person name for use as directory
    safe_name = args.person_name.replace(" ", "_").replace("/", "_")
    person_dir = Path(args.output_dir) / safe_name
    person_dir.mkdir(parents=True, exist_ok=True)

    net = load_face_detector()

    if args.mode == "images":
        input_path = Path(args.input_dir)
        saved = process_images(net, input_path, person_dir, args.max_crops)
    else:
        input_path = Path(args.input_dir)
        saved = process_video(net, input_path, person_dir, args.max_crops)

    logger.info(
        "Saved %d face crops to %s",
        saved, person_dir,
    )
    if saved < 20:
        logger.warning(
            "Only %d crops saved. Fine-tuning works best with 50+ images per person. "
            "Try adding more source images or lowering --conf_threshold.",
            saved,
        )
    else:
        logger.info(
            "Ready to train! Run:\n"
            "  python training/finetune_arcface.py "
            "--data_dir %s --epochs 20",
            Path(args.output_dir).resolve(),
        )


if __name__ == "__main__":
    main()
