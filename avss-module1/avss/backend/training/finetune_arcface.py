"""
AVSS Face Recognition Fine-Tuning
===================================
Fine-tunes the InsightFace ArcFace backbone on your own face dataset.

WHEN TO USE THIS:
  - Default InsightFace accuracy is insufficient on your video footage
  - Subjects wear partial occlusions (masks, caps)
  - Very low-resolution CCTV footage

WHEN NOT TO USE THIS:
  - For adding a single new person (just add their embedding — no training needed)
  - If you have fewer than 50 images per person (too little data)

DATASET STRUCTURE REQUIRED:
  training/data/
    person_001/
        img_001.jpg
        img_002.jpg
        ...
    person_002/
        img_001.jpg
        ...

  Each person folder = one identity.
  Minimum: 20 images per person, 10+ persons.
  Recommended: 50-200 images per person.

HOW IT WORKS:
  1. Load InsightFace's pre-trained backbone (ResNet-50 from buffalo_l)
  2. Replace the classification head with your number of identities
  3. Train with ArcFace loss (angular margin softmax)
  4. Export the backbone weights as .onnx for use in app/ai/recognition.py

USAGE:
  python training/finetune_arcface.py \
    --data_dir training/data \
    --output_dir training/output \
    --epochs 20 \
    --batch_size 32 \
    --lr 0.001

REQUIREMENTS:
  pip install torch torchvision onnx onnxruntime tqdm
"""

import argparse
import logging
import math
import os
from pathlib import Path

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from torchvision.models import resnet50
from PIL import Image
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Dataset
# ─────────────────────────────────────────────────────────────────────────────

class FaceDataset(Dataset):
    """
    Loads face images from a directory structure:
      root/person_name/image.jpg
    Each person becomes a class label.
    Images are resized to 112x112 (InsightFace standard).
    """

    def __init__(self, root_dir: str, transform=None):
        self.root = Path(root_dir)
        self.transform = transform
        self.samples: list[tuple[Path, int]] = []
        self.classes: list[str] = []

        # Build class list from subdirectory names
        for idx, person_dir in enumerate(sorted(self.root.iterdir())):
            if not person_dir.is_dir():
                continue
            self.classes.append(person_dir.name)
            for img_path in person_dir.iterdir():
                if img_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                    self.samples.append((img_path, idx))

        logger.info(
            "Dataset: %d identities, %d images",
            len(self.classes), len(self.samples),
        )

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        img_path, label = self.samples[idx]
        try:
            img = Image.open(img_path).convert("RGB")
        except Exception:
            # Return a black image if corrupt
            img = Image.new("RGB", (112, 112), (0, 0, 0))
        if self.transform:
            img = self.transform(img)
        return img, label

    @property
    def num_classes(self) -> int:
        return len(self.classes)


# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────

class ArcFaceBackbone(nn.Module):
    """
    ResNet-50 backbone that outputs L2-normalised 512-dim face embeddings.
    Architecture matches InsightFace's buffalo_l backbone.
    """

    def __init__(self, embedding_dim: int = 512):
        super().__init__()
        base = resnet50(weights="IMAGENET1K_V1")    # start from ImageNet weights
        # Remove the final classification layer
        self.backbone = nn.Sequential(*list(base.children())[:-1])
        self.embedding = nn.Linear(2048, embedding_dim)
        self.bn = nn.BatchNorm1d(embedding_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        features = self.backbone(x).flatten(1)
        emb = self.bn(self.embedding(features))
        return F.normalize(emb, p=2, dim=1)  # L2 normalise


class ArcFaceHead(nn.Module):
    """
    ArcFace classification head.
    Implements angular margin penalty: cos(θ + m) for the ground-truth class.
    This forces the model to learn embeddings with a larger angular margin
    between different identities — better separation for face recognition.
    """

    def __init__(self, embedding_dim: int, num_classes: int,
                 scale: float = 64.0, margin: float = 0.5):
        super().__init__()
        self.scale = scale
        self.margin = margin
        self.weight = nn.Parameter(torch.FloatTensor(num_classes, embedding_dim))
        nn.init.xavier_uniform_(self.weight)

        self.cos_m = math.cos(margin)
        self.sin_m = math.sin(margin)
        self.th = math.cos(math.pi - margin)
        self.mm = math.sin(math.pi - margin) * margin

    def forward(self, embeddings: torch.Tensor, labels: torch.Tensor) -> torch.Tensor:
        # Normalise weight vectors
        weight_norm = F.normalize(self.weight, p=2, dim=1)
        cos_theta = torch.mm(embeddings, weight_norm.t()).clamp(-1 + 1e-7, 1 - 1e-7)
        sin_theta = torch.sqrt(1.0 - cos_theta ** 2)

        # Apply angular margin to the ground-truth class
        cos_theta_m = cos_theta * self.cos_m - sin_theta * self.sin_m
        cos_theta_m = torch.where(cos_theta > self.th, cos_theta_m, cos_theta - self.mm)

        # One-hot encode labels
        one_hot = torch.zeros_like(cos_theta)
        one_hot.scatter_(1, labels.view(-1, 1), 1.0)

        # Replace ground-truth cosines with margin-penalised values
        output = one_hot * cos_theta_m + (1 - one_hot) * cos_theta
        return output * self.scale


# ─────────────────────────────────────────────────────────────────────────────
# Training
# ─────────────────────────────────────────────────────────────────────────────

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Training on: %s", device)

    # ── Dataset ───────────────────────────────────────────────────────────────
    transform = transforms.Compose([
        transforms.Resize((112, 112)),
        transforms.RandomHorizontalFlip(),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])

    dataset = FaceDataset(args.data_dir, transform=transform)
    if dataset.num_classes < 2:
        raise ValueError(
            f"Need at least 2 identity folders, found {dataset.num_classes}. "
            f"Check --data_dir={args.data_dir}"
        )
    if len(dataset) < 20:
        raise ValueError(
            f"Only {len(dataset)} images found. Need at least 20 total."
        )

    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=2,
        pin_memory=device.type == "cuda",
    )

    # ── Model ─────────────────────────────────────────────────────────────────
    backbone = ArcFaceBackbone(embedding_dim=512).to(device)
    head = ArcFaceHead(
        embedding_dim=512,
        num_classes=dataset.num_classes,
        scale=64.0,
        margin=0.5,
    ).to(device)

    # ── Optimiser ─────────────────────────────────────────────────────────────
    params = list(backbone.parameters()) + list(head.parameters())
    optimizer = torch.optim.SGD(params, lr=args.lr, momentum=0.9, weight_decay=5e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    criterion = nn.CrossEntropyLoss()

    # ── Training loop ─────────────────────────────────────────────────────────
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    best_loss = float("inf")

    for epoch in range(1, args.epochs + 1):
        backbone.train()
        head.train()
        total_loss = 0.0
        correct = 0
        total = 0

        for batch_idx, (images, labels) in enumerate(loader):
            images = images.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()
            embeddings = backbone(images)
            logits = head(embeddings, labels)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            preds = logits.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

            if batch_idx % 10 == 0:
                logger.info(
                    "Epoch %d/%d  batch %d/%d  loss=%.4f  acc=%.1f%%",
                    epoch, args.epochs, batch_idx, len(loader),
                    loss.item(), 100 * correct / total,
                )

        avg_loss = total_loss / len(loader)
        acc = 100 * correct / total
        scheduler.step()
        logger.info(
            "Epoch %d complete — avg_loss=%.4f  train_acc=%.1f%%  lr=%.6f",
            epoch, avg_loss, acc, scheduler.get_last_lr()[0],
        )

        # Save best model
        if avg_loss < best_loss:
            best_loss = avg_loss
            ckpt_path = output_dir / "best_backbone.pth"
            torch.save(backbone.state_dict(), ckpt_path)
            logger.info("Saved best model → %s", ckpt_path)

    logger.info("Training complete. Best loss: %.4f", best_loss)

    # ── Export to ONNX (for use with InsightFace / AVSS) ─────────────────────
    backbone.eval()
    backbone.load_state_dict(torch.load(output_dir / "best_backbone.pth", map_location=device))

    dummy_input = torch.randn(1, 3, 112, 112).to(device)
    onnx_path = output_dir / "avss_arcface.onnx"

    torch.onnx.export(
        backbone,
        dummy_input,
        str(onnx_path),
        input_names=["input"],
        output_names=["embedding"],
        dynamic_axes={"input": {0: "batch_size"}, "embedding": {0: "batch_size"}},
        opset_version=17,
    )
    logger.info("Exported ONNX model → %s", onnx_path)
    logger.info(
        "\nTo use your trained model in AVSS:\n"
        "  export AVSS_USE_PRETRAINED_FACE=false\n"
        "  export AVSS_CUSTOM_FACE_WEIGHTS=%s\n"
        "  Then restart the backend.",
        onnx_path.resolve(),
    )

    # ── Save identity map ─────────────────────────────────────────────────────
    import json
    id_map = {str(i): name for i, name in enumerate(dataset.classes)}
    (output_dir / "identity_map.json").write_text(json.dumps(id_map, indent=2))
    logger.info("Identity map saved → %s/identity_map.json", output_dir)
    logger.info("Identities trained: %s", list(id_map.values()))


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune ArcFace for AVSS")
    parser.add_argument(
        "--data_dir", type=str, default="training/data",
        help="Root folder with one subfolder per identity",
    )
    parser.add_argument(
        "--output_dir", type=str, default="training/output",
        help="Where to save weights and ONNX model",
    )
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.001)
    args = parser.parse_args()
    train(args)
