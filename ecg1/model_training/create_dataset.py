import os
import numpy as np
import pandas as pd
import scipy.signal as signal

def generate_ecg_beat(is_abnormal=False, length=187):
    """
    Generate a simple synthetic ECG beat (P, Q, R, S, T waves).
    Matches the Kaggle 187-timestep standard exactly.
    """
    x = np.linspace(0, 1, length)
    
    # Base baseline
    beat = np.zeros(length)
    
    # Heart rate variance
    hr_factor = np.random.uniform(0.8, 1.2) if not is_abnormal else np.random.uniform(0.5, 1.5)
    
    # P wave
    p_center, p_width, p_amp = 0.2 * hr_factor, 0.05, 0.1
    beat += p_amp * np.exp(-((x - p_center) ** 2) / (p_width ** 2))
    
    # QRS complex
    q_center, q_width, q_amp = 0.35 * hr_factor, 0.01, -0.15
    r_center, r_width, r_amp = 0.37 * hr_factor, 0.015, 1.0
    s_center, s_width, s_amp = 0.39 * hr_factor, 0.01, -0.25
    
    # Abnormal QRS might have wider or inverted R, deeper Q/S
    if is_abnormal:
        if np.random.rand() > 0.5:
            # Wide QRS
            r_width *= 2.5
            q_tmp = q_amp
            q_amp = s_amp
            s_amp = q_tmp
        else:
            # PVC like (premature ventricular contraction)
            r_center = 0.25
            r_amp = np.random.uniform(0.5, 1.5) * (1 if np.random.rand()>0.5 else -1)
            r_width = 0.04
            p_amp = 0 # No P wave
    
    beat += q_amp * np.exp(-((x - q_center) ** 2) / (q_width ** 2))
    beat += r_amp * np.exp(-((x - r_center) ** 2) / (r_width ** 2))
    beat += s_amp * np.exp(-((x - s_center) ** 2) / (s_width ** 2))
    
    # T wave
    t_center, t_width, t_amp = 0.6 * hr_factor, 0.08, 0.2
    if is_abnormal and np.random.rand() > 0.5:
        # Inverted T wave
        t_amp = -0.15
        
    beat += t_amp * np.exp(-((x - t_center) ** 2) / (t_width ** 2))
    
    # Add noise
    noise_level = 0.02
    if is_abnormal and np.random.rand() > 0.7:
        noise_level = 0.1 # More noisy signal
        
    beat += np.random.normal(0, noise_level, length)
    
    # EXACT Normalization match to signal_analysis.py
    # Strict [0.0, 1.0] Min-Max Normalization
    b_min = np.min(beat)
    b_max = np.max(beat)
    b_range = b_max - b_min
    if b_range > 0:
        beat = (beat - b_min) / b_range
        
    return beat

def generate_dataset(num_samples=1000, output_path='ecg_dataset.csv'):
    """
    Generate a dataset of ECG beats.
    50% Normal (Class 0), 50% Abnormal (Class 1)
    """
    print(f"Generating {num_samples} ECG samples...")
    data = []
    labels = []
    
    for _ in range(num_samples // 2):
        sig = generate_ecg_beat(is_abnormal=False)
        data.append(sig)
        labels.append(0) # Normal
        
    for _ in range(num_samples // 2):
        sig = generate_ecg_beat(is_abnormal=True)
        data.append(sig)
        labels.append(1) # Abnormal
        
    # Shuffle
    indices = np.arange(num_samples)
    np.random.shuffle(indices)
    
    data = np.array(data)[indices]
    labels = np.array(labels)[indices]
    
    # Create DataFrame
    df = pd.DataFrame(data)
    df['Label'] = labels
    
    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Dataset generated and saved to {output_path}")

if __name__ == "__main__":
    generate_dataset(1000, "model_training/ecg_dataset.csv")
