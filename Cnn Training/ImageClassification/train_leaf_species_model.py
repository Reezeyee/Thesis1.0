"""
Train Liberica vs Robusta leaf classifier → Float32 TFLite for CoffeeSpeciesTfliteClassifier.

Folder layout under ``Cnn Training/Data``:
  liberica/   (alphabetical first → index 0, matches Kotlin SPECIES_FOLDER_ORDER)
  robusta/    (index 1)

Preprocessing matches Android ImageNetInput.kt (same as train_cherry_model.py).

Usage:
  python train_leaf_species_model.py --epochs 20 --epochs-ft 10 --output-dir outputs/species_latest
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path
from typing import List, Sequence, Tuple

_mpl_cfg = Path(__file__).resolve().parent / ".mplconfig"
_mpl_cfg.mkdir(exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(_mpl_cfg))

import tensorflow as tf

from train_cherry_model import (
    IMG_EXT,
    build_model,
    evaluate_partition,
    export_tflite,
    make_ds,
    plot_history,
    repo_paths,
    stratified_split,
    unfreeze_last_layers,
)

# Must match CoffeeSpeciesTfliteClassifier.SPECIES_FOLDER_ORDER: liberica, robusta
CLASS_DIRS: Tuple[str, ...] = ("liberica", "robusta")
LABELS_DISPLAY: Tuple[str, ...] = ("Liberica", "Robusta")


def collect_leaf_paths(data_root: Path) -> Tuple[List[str], List[int]]:
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
    if len(paths) < 16:
        raise RuntimeError(f"Too few leaf images ({len(paths)}). Add more under liberica/ and robusta/.")
    return paths, labels


def main() -> int:
    parser = argparse.ArgumentParser(description="Train Liberica vs Robusta leaf model & export TFLite.")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--epochs-ft", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", type=str, default="outputs/species_latest")
    parser.add_argument("--skip-android-copy", action="store_true")
    args = parser.parse_args()

    _, data_root, android_assets = repo_paths()
    base_out = Path(args.output_dir)
    if not base_out.is_absolute():
        base_out = Path(__file__).resolve().parent / base_out
    base_out.mkdir(parents=True, exist_ok=True)

    tf.keras.utils.set_random_seed(args.seed)

    paths, labels = collect_leaf_paths(data_root)
    x_train, y_train, x_val, y_val, x_test, y_test = stratified_split(paths, labels, args.seed)

    batch_size = args.batch_size
    ds_train = make_ds(x_train, y_train, batch_size, shuffle=True, augment=True)
    ds_val = make_ds(x_val, y_val, batch_size, shuffle=False, augment=False)
    ds_test = make_ds(x_test, y_test, batch_size, shuffle=False, augment=False)

    print(f"Train images: {len(x_train)}, val: {len(x_val)}, test: {len(x_test)}")
    print(f"Classes (TF index order): {CLASS_DIRS}")

    model = build_model(
        num_classes=len(CLASS_DIRS),
        model_name="coffee_species_mobilenet_v2",
    )

    ckpt = tf.keras.callbacks.ModelCheckpoint(
        filepath=str(base_out / "best.keras"),
        monitor="val_accuracy",
        save_best_only=True,
        mode="max",
    )
    early = tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True)
    reduce = tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.4, patience=3, min_lr=1e-6)

    history = model.fit(
        ds_train,
        validation_data=ds_val,
        epochs=args.epochs,
        callbacks=[ckpt, early, reduce],
        verbose=1,
    )

    plot_history(history, base_out)

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

    hist_ft_obj = hist_ft.history
    hist_obj = history.history

    combined_loss = hist_obj["loss"] + hist_ft_obj["loss"]
    combined_val_loss = hist_obj["val_loss"] + hist_ft_obj["val_loss"]
    combined_acc = hist_obj["accuracy"] + hist_ft_obj["accuracy"]
    combined_val_acc = hist_obj["val_accuracy"] + hist_ft_obj["val_accuracy"]
    pseudo = tf.keras.callbacks.History()
    pseudo.history = {
        "loss": combined_loss,
        "val_loss": combined_val_loss,
        "accuracy": combined_acc,
        "val_accuracy": combined_val_acc,
    }
    plot_history(pseudo, base_out / "training_curves_full.png")

    tf.keras.models.save_model(model, base_out / "model_final.keras")

    labels_human: Sequence[str] = LABELS_DISPLAY
    evaluate_partition(model, ds_train, "Train", labels_human, base_out)
    evaluate_partition(model, ds_val, "Validation", labels_human, base_out)
    evaluate_partition(model, ds_test, "Test", labels_human, base_out)

    tflite_out = base_out / "coffee_species_model.tflite"
    export_tflite(model, tflite_out)

    summary = {
        "classes_folder_order": list(CLASS_DIRS),
        "kotlin_species_order_expected": ["liberica", "robusta"],
        "train_samples": int(len(x_train)),
        "val_samples": int(len(x_val)),
        "test_samples": int(len(x_test)),
        "tflite_path": str(tflite_out.resolve()),
    }
    with open(base_out / "run_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    if not args.skip_android_copy:
        dest = android_assets / "coffee_species_model.tflite"
        shutil.copy2(tflite_out, dest)
        print(f"Copied species TFLite to app assets: {dest}")

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
