from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
import numpy as np
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

clf = joblib.load("rf_model.joblib")
le = joblib.load("label_encoder.joblib")
latest_result = {}

class Features(BaseModel):
    features: dict

@app.post("/detect")
def detect_attack(data: Features):
    global latest_result
    df = pd.DataFrame([data.features])
    pred = clf.predict(df)[0]
    prob = clf.predict_proba(df)[0][pred]
    result = {
        "attack_type": le.inverse_transform([pred])[0],
        "confidence": float(np.round(prob, 3))
    }
    latest_result = result
    return result

@app.get("/latest")
def get_latest():
    return latest_result or {"attack_type": "None", "confidence": 0.0}
