import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from tqdm import tqdm

# Config
TRAIN_CSV = 'mitbih_train.csv'
OUTPUT_DIR = '../data/images'
NUM_SAMPLES_PER_CLASS = 1000  # 1000 normal, 1000 abnormal
INPUT_LEN = 187

def generate_images():
    # Make directories for Binary Classification (0=Normal, 1=Abnormal)
    # We will use subfolders so ImageDataGenerator can infer classes
    os.makedirs(os.path.join(OUTPUT_DIR, 'train', '0_Normal'), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, 'train', '1_Abnormal'), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, 'val', '0_Normal'), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, 'val', '1_Abnormal'), exist_ok=True)

    print(f"Loading {TRAIN_CSV}...")
    try:
        df = pd.read_csv(TRAIN_CSV, header=None)
    except FileNotFoundError:
        print(f"Error: {TRAIN_CSV} not found! Please run this script from inside ecg1/model_training or update the path.")
        return

    # Extract X (features) and y (labels)
    X = df.iloc[:, :INPUT_LEN].values
    y = df.iloc[:, INPUT_LEN].values.astype(int)

    # MIT-BIH labels: 
    # 0 = Normal
    # 1, 2, 3, 4 = Abnormal
    
    # Let's map MIT-BIH to binary: 0=Normal, 1=Abnormal
    y_binary = np.where(y == 0, 0, 1)

    # Separate normal and abnormal indices
    normal_indices = np.where(y_binary == 0)[0]
    abnormal_indices = np.where(y_binary == 1)[0]

    print(f"Total Normal available: {len(normal_indices)}")
    print(f"Total Abnormal available: {len(abnormal_indices)}")

    # Sample exactly what the user requested
    num_normal = min(NUM_SAMPLES_PER_CLASS, len(normal_indices))
    num_abnormal = min(NUM_SAMPLES_PER_CLASS, len(abnormal_indices))

    # Shuffle before picking
    np.random.seed(42)  # For reproducibility
    normal_indices = np.random.choice(normal_indices, num_normal, replace=False)
    abnormal_indices = np.random.choice(abnormal_indices, num_abnormal, replace=False)

    print(f"Generating {num_normal} normal images and {num_abnormal} abnormal images...")

    # Set up matplotlib for fast, headless generation
    plt.switch_backend('Agg')
    
    # 80% train, 20% validation split
    train_normal_split = int(0.8 * num_normal)
    train_abnormal_split = int(0.8 * num_abnormal)

    # Function to save a single row as an image
    def save_beat_image(row_data, folder, filename):
        fig, ax = plt.subplots(figsize=(2, 2), dpi=64) # 128x128 pixels (2*64)
        
        # Plot the signal line (black on white)
        ax.plot(row_data, color='black', linewidth=2)
        
        # Remove axes, borders, and margins (we just want the pure shape)
        ax.axis('off')
        plt.subplots_adjust(top=1, bottom=0, right=1, left=0, hspace=0, wspace=0)
        plt.margins(0,0)
        ax.xaxis.set_major_locator(plt.NullLocator())
        ax.yaxis.set_major_locator(plt.NullLocator())
        
        # Save as grayscale
        fig.savefig(os.path.join(folder, filename), bbox_inches='tight', pad_inches=0, format='png')
        plt.close(fig)

    print("Generating Normal images...")
    for i, idx in enumerate(tqdm(normal_indices)):
        split = 'train' if i < train_normal_split else 'val'
        folder = os.path.join(OUTPUT_DIR, split, '0_Normal')
        filename = f'normal_{i}.png'
        save_beat_image(X[idx], folder, filename)

    print("Generating Abnormal images...")
    for i, idx in enumerate(tqdm(abnormal_indices)):
        split = 'train' if i < train_abnormal_split else 'val'
        folder = os.path.join(OUTPUT_DIR, split, '1_Abnormal')
        filename = f'abnormal_{i}.png'
        save_beat_image(X[idx], folder, filename)

    print("Image generation complete! Images saved to 'ecg1/data/images/'")

if __name__ == "__main__":
    generate_images()
