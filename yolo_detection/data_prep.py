import os
import sys
import glob
import math
import random
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw

# ---------------------------------------------------------
# Target Class Schema (5 Classes)
# ---------------------------------------------------------
TARGET_CLASSES = {
    0: "Unripe",
    1: "Ripening",
    2: "Ripe",
    3: "Overripe",
    4: "Dry_Damaged"
}

CLASS_COLOR_MAP = {
    0: (34, 139, 34),     # Forest Green (Unripe)
    1: (255, 191, 0),    # Amber Yellow (Ripening)
    2: (220, 20, 60),     # Crimson Red (Ripe)
    3: (139, 69, 19),     # Saddle Brown (Overripe)
    4: (47, 79, 79)       # Dark Slate / Black (Dry/Damaged)
}

# Mapping rules from external dataset original class names to target 5 classes
EXTERNAL_CLASS_MAPPINGS = {
    "unripe": 0,
    "green": 0,
    "green_cherry": 0,
    "semi_ripe": 1,
    "semi-ripe": 1,
    "half-ripe": 1,
    "yellow": 1,
    "yellow_cherry": 1,
    "ripe": 2,
    "red": 2,
    "red_cherry": 2,
    "overripe": 3,
    "dark_brown_cherry": 3,
    "dry": 4,
    "dry_damaged": 4,
    "semi-dry": 4
}


def perceptual_hash(img: Image.Image, hash_size: int = 8) -> str:
    """Computes a simple average perceptual hash for image deduplication."""
    resized = img.convert("L").resize((hash_size, hash_size), Image.Resampling.BILINEAR)
    pixels = list(resized.getdata())
    avg = sum(pixels) / max(1, len(pixels))
    bits = "".join(["1" if p > avg else "0" for p in pixels])
    return hex(int(bits, 2))[2:].zfill(hash_size * hash_size // 4)


def create_synthetic_sample_dataset(dataset_dir: Path, num_samples: int = 150):
    """
    Generates realistic synthetic coffee branch images with multi-cherry annotations
    for pipeline verification and initial testing when external raw files aren't pre-downloaded.
    """
    print(f"Creating sample dataset with {num_samples} branch images in '{dataset_dir}'...")

    raw_images_dir = dataset_dir / "raw_images"
    raw_labels_dir = dataset_dir / "raw_labels"
    raw_images_dir.mkdir(parents=True, exist_ok=True)
    raw_labels_dir.mkdir(parents=True, exist_ok=True)

    random.seed(42)

    for i in range(num_samples):
        img_name = f"branch_sample_{i:04d}"
        w, h = 640, 640
        img = Image.new("RGB", (w, h), (40 + random.randint(-10, 10), 60 + random.randint(-10, 10), 30 + random.randint(-10, 10)))
        draw = ImageDraw.Draw(img)

        # Draw main stem/branch
        branch_y = random.randint(150, 490)
        draw.line([(0, branch_y - 20), (w, branch_y + 20)], fill=(80, 50, 20), width=18)
        draw.line([(0, branch_y - 20), (w, branch_y + 20)], fill=(50, 30, 10), width=10)

        # Generate 8 to 22 cherries per branch with mixed maturities and overlapping boxes
        num_cherries = random.randint(8, 22)
        annotations = []

        for _ in range(num_cherries):
            cls_id = random.choices([0, 1, 2, 3, 4], weights=[0.35, 0.25, 0.30, 0.06, 0.04])[0]
            cx = random.randint(60, w - 60)
            offset = int(random.gauss(0, 45)) if hasattr(random, 'gauss') else random.randint(-40, 40)
            cy = branch_y + offset
            cy = max(40, min(h - 40, cy))

            r = random.randint(18, 32)
            x1, y1 = cx - r, cy - r
            x2, y2 = cx + r, cy + r

            color = CLASS_COLOR_MAP[cls_id]
            draw.ellipse([x1, y1, x2, y2], fill=color, outline=(20, 20, 20), width=1)
            draw.ellipse([x1 + r // 2, y1 + r // 3, x1 + r // 2 + r // 3, y1 + r // 3 + r // 3], fill=(255, 255, 255, 120))

            norm_cx = cx / w
            norm_cy = cy / h
            norm_w = (2 * r) / w
            norm_h = (2 * r) / h

            annotations.append(f"{cls_id} {norm_cx:.6f} {norm_cy:.6f} {norm_w:.6f} {norm_h:.6f}")

        img.save(raw_images_dir / f"{img_name}.jpg")
        with open(raw_labels_dir / f"{img_name}.txt", "w") as f:
            f.write("\n".join(annotations) + "\n")

    print(f"Sample raw dataset successfully created: {num_samples} images.")


def prepare_yolo_dataset(base_dir: str = "yolo_detection/dataset", train_ratio: float = 0.7, val_ratio: float = 0.2):
    """
    Deduplicates images, maps classes, and creates non-overlapping Train (70%), Val (20%), Test (10%) splits.
    Generates YOLO data.yaml configuration file.
    """
    dataset_dir = Path(base_dir).resolve()
    raw_images_dir = dataset_dir / "raw_images"
    raw_labels_dir = dataset_dir / "raw_labels"

    if not raw_images_dir.exists() or len(list(raw_images_dir.glob("*.jpg"))) == 0:
        create_synthetic_sample_dataset(dataset_dir, num_samples=200)

    image_files = sorted(list(raw_images_dir.glob("*.jpg")) + list(raw_images_dir.glob("*.png")))
    print(f"Found {len(image_files)} raw images.")

    # 1. Deduplication using Perceptual Hash
    unique_hashes = set()
    valid_pairs = []
    duplicate_count = 0

    for img_path in image_files:
        lbl_path = raw_labels_dir / f"{img_path.stem}.txt"
        if not lbl_path.exists():
            continue

        try:
            with Image.open(img_path) as img:
                phash = perceptual_hash(img)
                if phash in unique_hashes:
                    duplicate_count += 1
                    continue
                unique_hashes.add(phash)
                valid_pairs.append((img_path, lbl_path))
        except Exception as e:
            print(f"Warning: Failed to load {img_path}: {e}")

    print(f"Deduplication complete. Deduplicated out {duplicate_count} near-duplicate images.")
    print(f"Remaining unique images: {len(valid_pairs)}")

    # 2. Shuffle & Non-Overlapping Split (70% Train, 20% Val, 10% Test)
    random.seed(123)
    random.shuffle(valid_pairs)

    n_total = len(valid_pairs)
    n_train = int(n_total * train_ratio)
    n_val = int(n_total * val_ratio)

    splits = {
        "train": valid_pairs[:n_train],
        "val": valid_pairs[n_train:n_train + n_val],
        "test": valid_pairs[n_train + n_val:]
    }

    # 3. Write structured YOLO directory hierarchy
    for split_name, pairs in splits.items():
        split_img_dir = dataset_dir / split_name / "images"
        split_lbl_dir = dataset_dir / split_name / "labels"
        split_img_dir.mkdir(parents=True, exist_ok=True)
        split_lbl_dir.mkdir(parents=True, exist_ok=True)

        for img_p, lbl_p in pairs:
            dst_img = split_img_dir / img_p.name
            dst_lbl = split_lbl_dir / lbl_p.name

            with open(img_p, "rb") as sf, open(dst_img, "wb") as df:
                df.write(sf.read())

            with open(lbl_p, "r") as sf, open(dst_lbl, "w") as df:
                for line in sf:
                    parts = line.strip().split()
                    if not parts:
                        continue
                    cls_val = parts[0]
                    if cls_val.isdigit():
                        cls_id = int(cls_val)
                    else:
                        cls_id = EXTERNAL_CLASS_MAPPINGS.get(cls_val.lower(), 0)

                    if cls_id in TARGET_CLASSES:
                        df.write(f"{cls_id} {' '.join(parts[1:])}\n")

    # 4. Generate data.yaml
    names_str = "\n".join([f"  {k}: '{v}'" for k, v in TARGET_CLASSES.items()])
    yaml_content = f"""path: {dataset_dir}
train: train/images
val: val/images
test: test/images

nc: {len(TARGET_CLASSES)}
names:
{names_str}
"""

    yaml_path = dataset_dir / "data.yaml"
    with open(yaml_path, "w") as f:
        f.write(yaml_content)

    print(f"\nYOLO Dataset Preparation Complete!")
    print(f"Data YAML: {yaml_path}")
    print(f"Splits -> Train: {len(splits['train'])}, Val: {len(splits['val'])}, Test: {len(splits['test'])}")
    return yaml_path


if __name__ == "__main__":
    prepare_yolo_dataset()
