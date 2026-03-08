import numpy as np
from scipy.signal import find_peaks, butter, filtfilt, resample
import os
try:
    from tensorflow.keras.models import load_model
except ImportError:
    load_model = None

# Global model variable for lazy loading
dl_model = None


def _butter_bandpass(lowcut, highcut, fs, order=3):
    nyq = 0.5 * fs
    low = max(0.001, lowcut / nyq)
    high = min(0.98, highcut / nyq)
    if low >= high:
        high = min(0.98, low + 0.1)
    b, a = butter(order, [low, high], btype='band')
    return b, a


def analyze_ecg_signal(signal_data, fs=100.0):
    """
    Analyze ECG signal: detect R-peaks and compute heart rate.
    
    Key insight: The R-peak is always the TALLEST positive deflection per beat.
    P-waves and T-waves are shorter. We exploit this by:
      1. Finding all positive peaks
      2. Keeping only the top-percentile peaks by amplitude (= R-peaks only)
      3. Computing BPM from those peaks via median RR interval
    """
    if not signal_data or len(signal_data) < 20:
        return _inconclusive("Signal too short.")

    sig = np.array(signal_data, dtype=float)

    # --- 1. Bandpass filter: 0.5 – 40 Hz ---
    if len(sig) > 100 and fs > 5:
        try:
            b, a = _butter_bandpass(0.5, min(40.0, fs * 0.45), fs, order=3)
            sig = filtfilt(b, a, sig)
        except Exception:
            pass

    # --- 2. Normalize to [0, 1] based on the positive half ---
    # This ensures negative deflections don't affect the percentile calculation.
    sig_min = sig.min()
    sig_max = sig.max()
    sig_range = sig_max - sig_min
    if sig_range == 0:
        return _inconclusive("Signal is flat.")
    sig_norm = (sig - sig_min) / sig_range  # now in [0, 1]

    # --- 3. Find all candidate peaks with loose criteria ---
    # Use 300ms min distance – this prevents multiple detections within same QRS
    min_dist = max(int(fs * 0.30), 3)
    all_peaks, _ = find_peaks(sig_norm, distance=min_dist, height=0.1)

    if len(all_peaks) < 2:
        # Try a very loose detection
        all_peaks, _ = find_peaks(sig_norm, distance=max(int(fs * 0.20), 2))

    if len(all_peaks) < 2:
        return _inconclusive("Could not detect enough peaks in the signal.")

    # --- 4. R-peak isolation: keep only the TOP 33% of peaks by height ---
    # R-peaks are always significantly taller than P and T waves.
    # By keeping only the tallest third, we exclude P/T waves reliably.
    peak_heights = sig_norm[all_peaks]
    threshold_33 = np.percentile(peak_heights, 67)   # top 33% = above 67th percentile
    r_peaks = all_peaks[peak_heights >= threshold_33]

    # Ensure we still have at least 2 R-peaks
    if len(r_peaks) < 2:
        r_peaks = all_peaks  # Fall back to all peaks

    # --- 5. Re-merge peaks that are too close together ---
    # After filtering, some consecutive R-peaks might still be too close (if
    # two nearby peaks pass the threshold). Keep the taller one in each pair.
    min_rr_samples = int(fs * 0.30)   # 300ms minimum
    r_peaks_final = [r_peaks[0]]
    for p in r_peaks[1:]:
        if p - r_peaks_final[-1] >= min_rr_samples:
            r_peaks_final.append(p)
        else:
            # Keep the taller one
            if sig_norm[p] > sig_norm[r_peaks_final[-1]]:
                r_peaks_final[-1] = p

    r_peaks_final = np.array(r_peaks_final)

    if len(r_peaks_final) < 2:
        return _inconclusive("Only one R-peak found after filtering.")

    # --- 6. Median RR interval → BPM ---
    rr = np.diff(r_peaks_final) / fs   # in seconds
    # Filter physiologically impossible values
    rr = rr[(rr >= 0.20) & (rr <= 3.0)]

    if len(rr) == 0:
        return _inconclusive("RR intervals out of physiological range.")

    bpm = 60.0 / float(np.median(rr))

    # --- 7. Classify ---
    if bpm < 60:
        abnormality = "Bradycardia"
        recommendation = (
            "Heart rate is lower than normal (below 60 BPM). "
            "Consult a doctor if you experience dizziness, fatigue, or fainting."
        )
    elif bpm > 100:
        abnormality = "Tachycardia"
        recommendation = (
            "Heart rate is higher than normal (above 100 BPM). "
            "Avoid caffeine and stress. Consult a doctor if persistent."
        )
    else:
        abnormality = "Normal"
        recommendation = "Your heart rate is within the normal range. Maintain a healthy lifestyle."

    # --- 8. Deep Learning Integration (Image-Based 2D CNN) ---
    global dl_model
    model_path = 'models/ecg_model_2d.h5'

    # New binary classes (based on our image generation: 0=Normal, 1=Abnormal)
    BINARY_CLASSES = {
        0: ('Normal Beat', False),
        1: ('Abnormal Beat', True)
    }

    # Lazy-load model
    if dl_model is None and load_model and os.path.exists(model_path):
        try:
            dl_model = load_model(model_path)
            print("Successfully loaded 2D CNN model.")
        except Exception as e:
            print(f"Failed to load model: {e}")
            pass

    if dl_model is not None:
        try:
            # --- Robust Scale-Invariant Extraction ---
            # Instead of guessing biological time via 'fs', 
            # we extract the beat relative to the spatial RR interval.
            if len(r_peaks_final) > 1:
                rr_intervals = np.diff(r_peaks_final)
                rr_idx = int(np.median(rr_intervals))
            elif len(r_peaks_final) == 1:
                # Fallback to a fraction of the entire signal if only 1 peak
                rr_idx = len(sig_norm) // 2
            else:
                rr_idx = len(sig_norm)
                
            if len(r_peaks_final) > 0:
                center = r_peaks_final[0]
                
                # Align R-peak to roughly index 80 in a 187-length vector (like MIT-BIH)
                # 80/187 = ~42% into the window. 
                # So pre-peak is 0.4 * RR, post-peak is 0.55 * RR.
                pre_samples = int(0.4 * rr_idx)
                post_samples = int(0.55 * rr_idx)
                
                start = max(0, center - pre_samples)
                end = min(len(sig_norm), center + post_samples)
                beat_segment = sig_norm[start:end]
                
                # If the peak was too close to the start, pad the beginning with the first value
                if center - pre_samples < 0:
                    pad_len = pre_samples - center
                    beat_segment = np.pad(beat_segment, (pad_len, 0), mode='edge')
            else:
                beat_segment = sig_norm

            # Resample exactly to 187 points. This ensures the shape is mathematically
            # identical regardless of the original image width/duration.
            beat_strict = np.zeros(187)
            if len(beat_segment) > 0:
                beat_resampled = resample(beat_segment, 187)
                beat_strict[:] = beat_resampled[:]

            # 4. Strict [0.0, 1.0] Min-Max Normalization
            b_min = np.min(beat_strict) if len(beat_strict) > 0 else 0
            b_max = np.max(beat_strict) if len(beat_strict) > 0 else 1
            b_range = b_max - b_min
            
            if b_range > 0:
                beat_strict = (beat_strict - b_min) / b_range
                
            # Heavy smoothing to simulate pristine MIT-BIH sensor data shape
            # User uploads parsed via OpenCV are highly stepped/jagged.
            try:
                from scipy.signal import savgol_filter
                # window length 15, polyorder 3 smooths it out nicely
                beat_strict = savgol_filter(beat_strict, 15, 3)
                
                # Re-normalize after smoothing just in case it dipped below 0 or above 1
                b_min = np.min(beat_strict)
                b_max = np.max(beat_strict)
                b_range = b_max - b_min
                if b_range > 0:
                    beat_strict = (beat_strict - b_min) / b_range
            except Exception:
                pass
                
            # --- 5. Image Generation (In-Memory) ---
            import matplotlib.pyplot as plt
            import io
            from PIL import Image
            import tensorflow as tf
            
            current_backend = plt.get_backend()
            plt.switch_backend('Agg')
            
            fig, ax = plt.subplots(figsize=(2, 2), dpi=64) # 128x128 pixels (2*64)
            ax.plot(beat_strict, color='black', linewidth=2)
            ax.axis('off')
            plt.subplots_adjust(top=1, bottom=0, right=1, left=0, hspace=0, wspace=0)
            plt.margins(0,0)
            ax.xaxis.set_major_locator(plt.NullLocator())
            ax.yaxis.set_major_locator(plt.NullLocator())
            
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', pad_inches=0)
            plt.close(fig)
            buf.seek(0)
            
            img = Image.open(buf).convert('RGB') 
            img = img.resize((128, 128))
            
            # --- DEBUG: Save it so we can see what the CNN sees!
            img.save('uploads/debug_tensor.png')
            
            img_array = np.array(img, dtype=np.float32)
            
            from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
            img_array = preprocess_input(img_array)
            
            img_tensor = np.expand_dims(img_array, axis=0)

            # --- 6. 2D CNN Inference ---
            prob = dl_model.predict(img_tensor, verbose=0)[0][0]
            
            # It's sigmoid: 1 is Abnormal, 0 is Normal
            pred_class = 1 if prob > 0.5 else 0
            confidence = (prob if pred_class == 1 else 1.0 - prob) * 100

            class_name, is_abnormal = BINARY_CLASSES[pred_class]
            dl_prediction = f"{class_name} ({confidence:.1f}% confidence)"

            # --- Smart Merging of HR (Rate) and DL (Rhythm) ---
            if is_abnormal:
                if abnormality == 'Normal':
                    abnormality = class_name
                    recommendation = (
                        f"The 2D Image-Based AI model "
                        f"detected an '{class_name}' pattern with {confidence:.1f}% confidence. "
                        f"Please consult a cardiologist for further evaluation."
                    )
                else:
                    hr_condition = abnormality
                    abnormality = f"{class_name} & {hr_condition}"
                    recommendation = (
                        f"Your heart rate indicates {hr_condition}. "
                        f"Additionally, the Image AI model detected an '{class_name}' pattern "
                        f"with {confidence:.1f}% confidence."
                    )
            else:
                if abnormality == 'Normal':
                    abnormality = "Normal Beat"
                    recommendation = (
                        f"Your heart rate is within normal range. "
                        f"The Image AI model also confirms a Normal Beat "
                        f"({confidence:.1f}% confidence)."
                    )
                else:
                    hr_condition = abnormality
                    abnormality = f"Abnormal Rate ({hr_condition})"
                    recommendation = (
                        f"While the image model detected a normal resting wave pattern ({confidence:.1f}% confidence), "
                        f"your overall heart rate strongly indicates {hr_condition}. "
                        f"Please consult a physician for a proper diagnosis."
                    )

        except Exception as e:
            import traceback
            print(f"DL Image Error encountered:")
            traceback.print_exc()
            dl_prediction = f"DL Image Error: {str(e)}"
    else:
        dl_prediction = "2D DL model not loaded (run train.py first)"

    # High stress if not perfectly normal
    stress = "Low" if abnormality == "Normal Beat" else "High"

    return {
        'heart_rate': round(bpm, 1),
        'abnormality': abnormality,
        'stress_level': stress,
        'recommendation': recommendation,
        'dl_prediction': dl_prediction
    }


def _inconclusive(reason=""):
    return {
        'heart_rate': 0,
        'abnormality': 'Inconclusive',
        'stress_level': 'Unknown',
        'recommendation': f'Signal analysis inconclusive: {reason}'
    }
