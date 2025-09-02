import os
import time
import random
import pandas as pd
import requests

API = os.getenv("API_URL") or "http://localhost:8000/detect"
DELAY = float(os.getenv("SIM_DELAY") or "2")

df = pd.read_csv("logs.csv", encoding="utf-8")
labels = sorted(df["Label"].dropna().unique().tolist())

label_data = {}
for label in labels:
    subset = df[df["Label"] == label].copy()
    for col in ("Label", "LabelEnc"):
        if col in subset.columns:
            subset.drop(columns=[col], inplace=True)
    label_data[label] = subset.reset_index(drop=True)

while True:
    label = random.choice(labels)
    subset = label_data[label]
    assert "Label" in df.columns, "No Label column found"

    # Skip empty datasets (shouldn't happen but just in case)
    if subset.empty:
        continue
    
    sample = subset.sample(1).to_dict(orient="records")[0]
    res = requests.post(API, json={"features": sample}, timeout=10)
    print("=== Label ===", label)
    print("=== Sent ===", sample)
    print("=== Received ===", res.json())
    time.sleep(DELAY)




