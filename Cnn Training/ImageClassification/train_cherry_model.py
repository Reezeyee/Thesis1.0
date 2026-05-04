"""
Train a 3-class cherry ripeness CNN (Overripe / Ripe / Unripe), evaluate train/val/test,
plot curves + confusion matrices, export Float32 TFLite for Capture tab.

Input preprocessing matches Android ImageNetInput.kt (RGB /255 then ImageNet mean/std).

Usage (from ImageClassification, venv activated):
  python train_cherry_model.py --epochs 25 --output-dir outputs/run1
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

_mpl_cfg = Path(__file__).resolve().parent / ".mplconfig"
_mpl_cfg.mkdir(exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(_mpl_cfg))

from typing import Dict, List, Sequence, Tuple

import matplotlib.pyplot as plt
import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

# Folder names must stay alphabetical order expected by Kotlin CherryGradeTfliteClassifier:
# Overripe=0, Ripe=1, Unripe=2  -> matches sorted(["Overripe","Ripe","Unripe"])
CLASS_DIRS: Tuple[str, ...] = ("Overripe", "Ripe", "Unripe")

IMG_SIZE = 224
MEAN_TF = tf.constant([0.485, 0.456, 0.406], dtype=tf.float32)
STD_TF = tf.constant([0.229, 0.224, 0.225], dtype=tf.float32)

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def repo_paths() -> Tuple[Path, Path, Path]:
    base = Path(__file__).resolve().parent
    data_root = base.parent / "Data"
    android_assets = base.parent.parent / "app" / "src" / "main" / "assets"
    return base, data_root, android_assets


def collect_paths(data_root: Path) -> Tuple[List[str], List[int]]:
    paths: List[str] = []
    labels: List[int] = []
    for idx, dirname in enumerate(CLASS_DIRS):
        folder = data_root / dirname
        if not folder.is_dir():
            raise FileNotFoundError(f"Missing class folder: {folder}")
        for p in sorted(folder.iterdir()):
            if p.suffix.lower() not in IMG_EXT:
                continue
            paths.append(str(p.resolve()))
            labels.append(idx)
    if len(paths) < 30:
        raise RuntimeError(f"Too few images ({len(paths)}). Expected hundreds per class.")
    return paths, labels


def stratified_split(
    paths: Sequence[str],
    labels: Sequence[int],
    seed: int,
    train_frac: float = 0.70,
    val_frac: float = 0.15,
    test_frac: float = 0.15,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    labels_arr = np.array(labels)
    paths_arr = np.array(paths)
    remainder = 1.0 - train_frac
    x_train, x_temp, y_train, y_temp = train_test_split(
        paths_arr,
        labels_arr,
        test_size=remainder,
        stratify=labels_arr,
        random_state=seed,
    )
    # Second split: sklearn assigns fraction test_size of x_temp to the *second* output.
    test_size_2 = test_frac / remainder
    x_val, x_test, y_val, y_test = train_test_split(
        x_temp,
        y_temp,
        test_size=test_size_2,
        stratify=y_temp,
        random_state=seed,
    )
    return x_train, y_train, x_val, y_val, x_test, y_test


def make_ds(
    paths: np.ndarray,
    labels: np.ndarray,
    batch_size: int,
    shuffle: bool,
    augment: bool,
) -> tf.data.Dataset:
    ds = tf.data.Dataset.from_tensor_slices((paths, labels))

    def decode(path: tf.Tensor, label: tf.Tensor):
        img_bytes = tf.io.read_file(path)
        img = tf.io.decode_image(img_bytes, channels=3, expand_animations=False)
        img.set_shape([None, None, 3])
        img = tf.image.resize(img, [IMG_SIZE, IMG_SIZE])
        img = tf.cast(img, tf.float32) / 255.0
        if augment:

            def aug_batch(i):
                x = tf.image.random_flip_left_right(i)
                x = tf.image.random_brightness(x, max_delta=0.08)
                return tf.clip_by_value(x, 0.0, 1.0)

            img = aug_batch(img)
        img = (img - MEAN_TF) / STD_TF
        return img, label

    ds = ds.map(decode, num_parallel_calls=tf.data.AUTOTUNE)
    if shuffle:
        ds = ds.shuffle(min(len(paths), 2048), reshuffle_each_iteration=True)
    return ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)


@tf.keras.utils.register_keras_serializable(package="coffee")
class AppRgbToMobilenetPrep(tf.keras.layers.Layer):
    """Maps Kotlin-style normalized floats to MobileNetV2 preprocess_input range."""

    def call(self, inputs: tf.Tensor) -> tf.Tensor:
        rgb01 = tf.clip_by_value(inputs * STD_TF + MEAN_TF, 0.0, 1.0)
        rgb255 = rgb01 * 255.0
        return tf.keras.applications.mobilenet_v2.preprocess_input(rgb255)

    def get_config(self) -> Dict:
        return super().get_config()


def build_model(
    num_classes: int = 3,
    dropout: float = 0.25,
    model_name: str = "cherry_ripeness_mobilenet_v2",
) -> tf.keras.Model:
    inp = tf.keras.layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3), dtype=tf.float32, name="normalized_rgb")
    prep = AppRgbToMobilenetPrep(name="denorm_and_mobilenet_prep")(inp)
    base = tf.keras.applications.MobileNetV2(
        include_top=False,
        weights="imagenet",
        input_tensor=prep,
        pooling="avg",
    )
    base.trainable = False
    x = tf.keras.layers.Dropout(dropout)(base.output)
    out = tf.keras.layers.Dense(num_classes, activation="softmax", name="softmax")(x)
    model = tf.keras.Model(inp, out, name=model_name)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    return model


def unfreeze_last_layers(model: tf.keras.Model, trainable_layers: int = 55) -> None:
    """Fine-tune only the top ``trainable_layers`` of MobileNetV2 (counted from output side)."""
    base = None
    for layer in model.layers:
        if isinstance(layer, tf.keras.Model):
            base = layer
            break
    if base is None:
        return
    base.trainable = True
    trainable_seen = 0
    for lay in reversed(base.layers):
        lay.trainable = trainable_seen < trainable_layers
        trainable_seen += 1


def plot_history(history: tf.keras.callbacks.History, out_path: Path) -> None:
    h = history.history
    epochs = range(1, len(h["loss"]) + 1)
    fig, ax = plt.subplots(1, 2, figsize=(11, 4))
    ax[0].plot(epochs, h["loss"], label="train_loss")
    ax[0].plot(epochs, h["val_loss"], label="val_loss")
    ax[0].set_title("Loss")
    ax[0].legend()
    ax[0].grid(True, alpha=0.3)
    ax[1].plot(epochs, h["accuracy"], label="train_acc")
    ax[1].plot(epochs, h["val_accuracy"], label="val_acc")
    ax[1].set_title("Accuracy")
    ax[1].legend()
    ax[1].grid(True, alpha=0.3)
    plt.tight_layout()
    save_to = (
        out_path
        if out_path.suffix.lower() in (".png", ".jpg", ".jpeg", ".pdf", ".svg")
        else out_path / "training_curves.png"
    )
    fig.savefig(save_to, dpi=150)
    plt.close(fig)


def plot_confusion(cm: np.ndarray, labels: Sequence[str], title: str, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(6, 5))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax)
    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=labels,
        yticklabels=labels,
        ylabel="True",
        xlabel="Predicted",
        title=title,
    )
    plt.setp(ax.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
    thresh = cm.max() / 2.0 if cm.size else 0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j,
                i,
                format(cm[i, j], "d"),
                ha="center",
                va="center",
                color="white" if cm[i, j] > thresh else "black",
            )
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def evaluate_partition(
    model: tf.keras.Model,
    ds: tf.data.Dataset,
    partition_name: str,
    labels_human: Sequence[str],
    out_dir: Path,
) -> Dict[str, float]:
    y_pred_chunks: List[np.ndarray] = []
    y_true_chunks: List[np.ndarray] = []
    for batch_x, batch_y in ds:
        prob = model.predict_on_batch(batch_x)
        y_pred_chunks.append(np.argmax(prob, axis=1))
        y_true_chunks.append(batch_y.numpy())
    if not y_pred_chunks:
        return {}
    y_pred = np.concatenate(y_pred_chunks)
    y_true = np.concatenate(y_true_chunks)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(len(labels_human))))
    plot_confusion(cm, labels_human, f"Confusion — {partition_name}", out_dir / f"confusion_{partition_name.lower()}.png")
    report = classification_report(y_true, y_pred, target_names=list(labels_human), output_dict=True, digits=4)
    acc = float(np.mean(y_pred == y_true))
    metrics = {"accuracy": acc, "classification_report": report}
    with open(out_dir / f"metrics_{partition_name.lower()}.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)
    print(f"[{partition_name}] accuracy={acc:.4f}")
    print(classification_report(y_true, y_pred, target_names=list(labels_human)))
    return metrics


def export_tflite(model: tf.keras.Model, out_path: Path) -> None:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = []
    tflite_bytes = converter.convert()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(tflite_bytes)
    print(f"Wrote TFLite ({len(tflite_bytes) // 1024} KB): {out_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Train cherry ripeness model & export TFLite.")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--epochs-ft", type=int, default=15, help="Fine-tune epochs after unfreezing MobileNet.")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", type=str, default="outputs/latest")
    parser.add_argument("--skip-android-copy", action="store_true")
    args = parser.parse_args()

    _, data_root, android_assets = repo_paths()
    base_out = Path(args.output_dir)
    if not base_out.is_absolute():
        base_out = Path(__file__).resolve().parent / base_out
    base_out.mkdir(parents=True, exist_ok=True)

    tf.keras.utils.set_random_seed(args.seed)

    paths, labels = collect_paths(data_root)
    x_train, y_train, x_val, y_val, x_test, y_test = stratified_split(paths, labels, args.seed)

    batch_size = args.batch_size
    ds_train = make_ds(x_train, y_train, batch_size, shuffle=True, augment=True)
    ds_val = make_ds(x_val, y_val, batch_size, shuffle=False, augment=False)
    ds_test = make_ds(x_test, y_test, batch_size, shuffle=False, augment=False)

    print(f"Train images: {len(x_train)}, val: {len(x_val)}, test: {len(x_test)}")
    print(f"Classes (index order): {CLASS_DIRS}")

    model = build_model(num_classes=len(CLASS_DIRS))

    ckpt = tf.keras.callbacks.ModelCheckpoint(
        filepath=str(base_out / "best.keras"),
        monitor="val_accuracy",
        save_best_only=True,
        mode="max",
    )
    early = tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=6, restore_best_weights=True)
    reduce = tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.4, patience=3, min_lr=1e-6)

    history = model.fit(
        ds_train,
        validation_data=ds_val,
        epochs=args.epochs,
        callbacks=[ckpt, early, reduce],
        verbose=1,
    )

    plot_history(history, base_out)

    # Fine-tune
    unfreeze_last_layers(model, trainable_layers=55)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=5e-5),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    hist_ft = model.fit(
        ds_train,
        validation_data=ds_val,
        epochs=args.epochs_ft,
        callbacks=[ckpt, early, reduce],
        verbose=1,
    )

    # Combined plot for thesis appendix (phase 2 appended)
    combined_loss = history.history["loss"] + hist_ft.history["loss"]
    combined_val_loss = history.history["val_loss"] + hist_ft.history["val_loss"]
    combined_acc = history.history["accuracy"] + hist_ft.history["accuracy"]
    combined_val_acc = history.history["val_accuracy"] + hist_ft.history["val_accuracy"]
    pseudo = tf.keras.callbacks.History()
    pseudo.history = {
        "loss": combined_loss,
        "val_loss": combined_val_loss,
        "accuracy": combined_acc,
        "val_accuracy": combined_val_acc,
    }
    plot_history(pseudo, base_out / "training_curves_full.png")

    tf.keras.models.save_model(model, base_out / "model_final.keras")

    labels_human = list(CLASS_DIRS)
    evaluate_partition(model, ds_train, "Train", labels_human, base_out)
    evaluate_partition(model, ds_val, "Validation", labels_human, base_out)
    evaluate_partition(model, ds_test, "Test", labels_human, base_out)

    tflite_out = base_out / "cherry_grade_model.tflite"
    export_tflite(model, tflite_out)

    summary = {
        "classes_index_order": labels_human,
        "train_samples": int(len(x_train)),
        "val_samples": int(len(x_val)),
        "test_samples": int(len(x_test)),
        "epochs_frozen": args.epochs,
        "epochs_finetune": args.epochs_ft,
        "matches_android_ImageNetInput": True,
        "tflite_path": str(tflite_out.resolve()),
    }
    with open(base_out / "run_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    if not args.skip_android_copy:
        dest = android_assets / "cherry_grade_model.tflite"
        shutil.copy2(tflite_out, dest)
        print(f"Copied TFLite to app Capture assets: {dest}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
