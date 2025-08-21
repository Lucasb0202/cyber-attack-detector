import pandas as pd
import time
import requests

df = pd.read_csv("cic_combined_with_logs.csv")  
df = df.drop(columns=["Label", "LabelEnc"])  

while True:
    sample = df.sample(1).to_dict(orient="records")[0]
    response = requests.post("http://localhost:8000/detect", json={"features": sample})
    print("=== Sent ===\n", sample)
    print("=== Received ===\n", response.json())
    time.sleep(2)
