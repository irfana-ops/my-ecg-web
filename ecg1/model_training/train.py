"""
===================================================
 ECG Image-Based Deep Learning Training Script
 Dataset: Formatted MIT-BIH Images
===================================================

 Trains a 2D CNN on 128x128 grayscale ECG images.
 Classes:
       0 = Normal
       1 = Abnormal (any of class 1, 2, 3, 4)
===================================================
"""

import os
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import (
    Conv2D, MaxPooling2D, Flatten, Dense, Dropout, BatchNormalization
)
from tensorflow.keras.callbacks import ModelCheckpoint, EarlyStopping, ReduceLROnPlateau

# ───────────────────────────────────────────────
# CONFIG
# ───────────────────────────────────────────────
IMAGE_DIR   = '../data/images'
MODEL_PATH  = '../models/ecg_model_2d.h5'
IMG_SIZE    = (128, 128)
BATCH_SIZE  = 32

# ───────────────────────────────────────────────
# DATA LOADING (ImageDataGenerator replacement)
# ───────────────────────────────────────────────
def load_datasets():
    print(f"Loading images from: {IMAGE_DIR}")
    
    train_dir = os.path.join(IMAGE_DIR, 'train')
    val_dir = os.path.join(IMAGE_DIR, 'val')

    if not os.path.exists(train_dir):
        print(f"Error: Directory {train_dir} does not exist. Run convert_to_images.py first.")
        return None, None

    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        labels='inferred',
        label_mode='binary',   # 0 or 1
        color_mode='rgb',
        batch_size=BATCH_SIZE,
        image_size=IMG_SIZE,
        shuffle=True,
        seed=42
    )

    val_ds = tf.keras.utils.image_dataset_from_directory(
        val_dir,
        labels='inferred',
        label_mode='binary',
        color_mode='rgb',
        batch_size=BATCH_SIZE,
        image_size=IMG_SIZE,
        shuffle=False
    )
    
    # Preprocess for MobileNetV2: scaling to [-1, 1]
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
    train_ds = train_ds.map(lambda x, y: (preprocess_input(x), y))
    val_ds = val_ds.map(lambda x, y: (preprocess_input(x), y))

    # Optimize for performance
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

    return train_ds, val_ds

# ───────────────────────────────────────────────
# MODEL ARCHITECTURE  (2D-CNN)
# ───────────────────────────────────────────────
def build_model():
    """
    MobileNetV2 based architecture with Data Augmentation
      Input : (128, 128, 3)
      Output: Binary (Sigmoid)
    """
    from tensorflow.keras.applications import MobileNetV2
    from tensorflow.keras.layers import GlobalAveragePooling2D, InputLayer, RandomTranslation, RandomZoom

    base_model = MobileNetV2(
        input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3),
        include_top=False,
        weights='imagenet'
    )
    # Fine-tune the top layers
    base_model.trainable = True
    for layer in base_model.layers[:100]:
        layer.trainable = False

    data_augmentation = Sequential([
        RandomTranslation(height_factor=0.05, width_factor=0.1),
        RandomZoom(height_factor=(-0.1, 0.1), width_factor=(-0.1, 0.1))
    ], name='data_augmentation')

    model = Sequential([
        InputLayer(input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3)),
        data_augmentation,
        base_model,
        GlobalAveragePooling2D(),
        Dense(128, activation='relu'),
        Dropout(0.5),
        Dense(1, activation='sigmoid')
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )
    return model

# ───────────────────────────────────────────────
# TRAINING
# ───────────────────────────────────────────────
def train():
    os.makedirs('../models', exist_ok=True)

    train_ds, val_ds = load_datasets()
    if train_ds is None:
        return

    # -- Build model --
    print("\nBuilding 2D CNN model...")
    model = build_model()
    model.summary()

    # -- Callbacks --
    callbacks = [
        ModelCheckpoint(MODEL_PATH, monitor='val_accuracy',
                        save_best_only=True, mode='max', verbose=1),
        EarlyStopping(monitor='val_loss', patience=5,
                      restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5,
                          patience=2, verbose=1, min_lr=1e-6)
    ]

    # -- Train --
    print("\nStarting training on ECG Images...\n")
    model.fit(
        train_ds,
        epochs=15, # Start with 15 epochs for images
        validation_data=val_ds,
        callbacks=callbacks,
        verbose=1
    )

    print(f"\nTraining complete! Best model saved to: {MODEL_PATH}")
    print("   Update signal_analysis.py to use this image-based model.\n")


if __name__ == "__main__":
    train()
