"""
Coffee cherry image classification — validate images, remove corrupt files, load tf.data.

Expects class folders under `data/` (e.g. Unripe, Ripe, Overripe). If `data` is missing,
creates a symlink to ../Data when that folder exists.
"""
from __future__ import annotations

import imghdr
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, List, Optional, Sequence, Tuple

import cv2
import tensorflow as tf

# Path to image root (directory containing one folder per class)
BASE_DIR = Path(__file__).resolve().parent
data_dir = str(BASE_DIR / "data")

img_exts = ["jpeg", "jpg", "bmp", "png"]


def _ensure_data_link() -> Path:
    """Use ./data if present; otherwise symlink ../Data -> data when available."""
    target = BASE_DIR / "data"
    legacy = BASE_DIR.parent / "Data"
    if target.exists():
        return target.resolve()
    if legacy.is_dir():
        target.symlink_to(legacy.resolve(), target_is_directory=True)
        return target.resolve()
    target.mkdir(parents=True, exist_ok=True)
    return target.resolve()


def _normalized_suffix(path: Path) -> Optional[str]:
    if not path.suffix:
        return None
    ext = path.suffix.lower().lstrip(".")
    if ext == "jpeg":
        return "jpeg"
    return ext if ext in img_exts else None


def _imghdr_kind(path: Path) -> Optional[str]:
    kind = imghdr.what(str(path))
    return kind


def is_dodgy_image(path: Path) -> Tuple[bool, str]:
    """
    Return (is_bad, reason). OpenCV verifies bytes decode; imghdr cross-checks payload kind.
    """
    ext = _normalized_suffix(path)
    if ext is None:
        return True, "extension_not_allowed"

    img = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if img is None:
        return True, "opencv_decode_failed"
    if img.size == 0:
        return True, "empty_array"
    h, w = img.shape[:2]
    if h < 2 or w < 2:
        return True, f"too_small({w}x{h})"

    hdr = _imghdr_kind(path)
    if hdr is not None and hdr not in ("jpeg", "png", "bmp"):
        return True, f"imghdr_unsupported({hdr})"

    return False, ""


def iter_image_files(root: Path) -> Iterator[Path]:
    allowed = {e.lower() for e in img_exts}
    for dirpath, _, filenames in os.walk(root):
        for name in filenames:
            p = Path(dirpath) / name
            suf = p.suffix.lower().lstrip(".")
            if suf == "jpeg" or suf in allowed:
                yield p


def remove_dodgy_images(root: Path, dry_run: bool = False) -> List[Tuple[str, str]]:
    """
    Delete corrupt or inconsistent images under root. Returns list of (path, reason).
    """
    removed: List[Tuple[str, str]] = []
    for path in iter_image_files(root):
        bad, reason = is_dodgy_image(path)
        if not bad:
            continue
        removed.append((str(path), reason))
        if not dry_run:
            try:
                path.unlink()
            except OSError as e:
                removed[-1] = (str(path), f"{reason}:unlink_failed:{e}")
    return removed


@dataclass
class LoadedDataset:
    train_ds: tf.data.Dataset
    val_ds: tf.data.Dataset
    class_names: Tuple[str, ...]


def load_data(
    batch_size: int = 32,
    image_size: Tuple[int, int] = (224, 224),
    validation_split: float = 0.2,
    seed: int = 42,
    shuffle_buffer: int = 1024,
) -> LoadedDataset:
    """
    Load images from data_dir using Keras utilities (train/val split).
    Run remove_dodgy_images first for a clean tree.
    """
    root = _ensure_data_link()
    if not root.is_dir():
        raise FileNotFoundError(f"Missing dataset directory: {root}")

    train_ds = tf.keras.utils.image_dataset_from_directory(
        root,
        validation_split=validation_split,
        subset="training",
        seed=seed,
        image_size=image_size,
        batch_size=batch_size,
        label_mode="int",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        root,
        validation_split=validation_split,
        subset="validation",
        seed=seed,
        image_size=image_size,
        batch_size=batch_size,
        label_mode="int",
    )

    class_names = tuple(train_ds.class_names)

    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.shuffle(shuffle_buffer).prefetch(AUTOTUNE)
    val_ds = val_ds.prefetch(AUTOTUNE)

    return LoadedDataset(train_ds=train_ds, val_ds=val_ds, class_names=class_names)


def main(argv: Sequence[str]) -> int:
    dry = "--dry-run" in argv
    root = _ensure_data_link()
    print(f"data_dir (resolved): {root}", file=sys.stderr)
    print("Scanning for dodgy images...", file=sys.stderr)
    report = remove_dodgy_images(root, dry_run=dry)
    print(f"Removed {len(report)} dodgy images{' (dry-run)' if dry else ''}.")
    for path, reason in report[:50]:
        print(f"  {reason}: {path}")
    if len(report) > 50:
        print(f"  ... and {len(report) - 50} more.")

    if dry:
        print("Skipping dataset load (--dry-run).", file=sys.stderr)
        return 0

    loaded = load_data(batch_size=16)
    print("Classes:", loaded.class_names)
    for images, labels in loaded.train_ds.take(1):
        print("Batch shape:", images.shape, "labels:", labels.shape)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
