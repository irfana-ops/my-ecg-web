import pandas as pd

df = pd.read_csv('model_training/ecg_dataset.csv')
print(f"Shape: {df.shape}")
print(f"Normal (0): {len(df[df['Label']==0])}")
print(f"Abnormal (1): {len(df[df['Label']==1])}")
print("\nFirst 3 rows (first 5 signal columns + Label):")
print(df[list(df.columns[:5]) + ['Label']].head(3).to_string())
