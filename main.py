from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd
import joblib
import numpy as np
from fastapi.middleware.cors import CORSMiddleware
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import os
from datetime import datetime


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

def generate_report(attack_type: str, confidence: float):
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    if not os.path.exists("reports"):
        os.makedirs("reports")
    filename = f"reports/attack_report_{timestamp}.pdf"

    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, height - 50, "Cyber Attack Detection Report")

    c.setFont("Helvetica", 14)
    c.drawString(50, height - 100, f"Date & Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    c.drawString(50, height - 130, f"Attack Type: {attack_type}")
    c.drawString(50, height - 160, f"Confidence: {confidence * 100:.2f}%")

    c.save()


@app.post("/detect")
@app.post("/detect")
def detect_attack(data: Features):
    global latest_result
    df = pd.DataFrame([data.features])
    pred = clf.predict(df)[0]
    prob = clf.predict_proba(df)[0][pred]
    attack_type = le.inverse_transform([pred])[0]
    confidence = float(np.round(prob, 3))

    result = {
        "attack_type": attack_type,
        "confidence": confidence
    }
    latest_result = result

    if attack_type.lower() != "none":
        generate_report(attack_type, confidence)

    return result


@app.get("/latest")
def get_latest():
    return latest_result or {"attack_type": "None", "confidence": 0.0}
