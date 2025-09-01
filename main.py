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
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# from fastapi.staticfiles import StaticFiles
# from fastapi.responses import FileResponse


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
last_report_path = None

class Features(BaseModel):
    features: dict


# app.mount("/static", StaticFiles(directory="static"), name="static")

# @app.get("/")
# def serve_root():
#     return FileResponse("static/index.html")


def generate_report(attack_type: str, confidence: float, features: dict) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    if not os.path.exists("reports"):
        os.makedirs("reports")
    filename = f"reports/attack_report_{timestamp}.pdf"

    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4

    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, height - 50, "Cyber Attack Detection Report")

    c.setFont("Helvetica", 12)
    c.drawString(50, height - 90, f"Date & Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    c.drawString(50, height - 110, f"Attack Type: {attack_type}")
    c.drawString(50, height - 130, f"Confidence: {confidence * 100:.2f}%")
    c.drawString(50, height - 150, f"Model: Random Forest")
    c.drawString(50, height - 170, f"Simulation Source: CIC + Real Packets")

    y = height - 200
    for key, val in list(features.items())[:15]:
        c.drawString(50, y, f"{key}: {val}")
        y -= 20
        if y < 50:
            c.showPage()
            y = height - 50

    c.save()
    return filename  


@app.post("/detect")
def detect_attack(data: Features):
    global latest_result, last_report_path
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
        last_report_path = generate_report(attack_type, confidence, data.features)

    return result

@app.get("/reports")
def list_reports():
    if not os.path.exists("reports"):
        return {"reports": []}
    files = []
    for name in os.listdir("reports"):
        if name.lower().endswith(".pdf"):
            p = os.path.join("reports", name)
            files.append({
                "name": name,
                "size": os.path.getsize(p),
                "mtime": os.path.getmtime(p)
            })
    files.sort(key=lambda x: x["mtime"], reverse=True)
    return {"reports": files}

@app.get("/reports/latest")
def latest_report():
    global last_report_path
    if last_report_path and os.path.exists(last_report_path):
        name = os.path.basename(last_report_path)
        return FileResponse(last_report_path, media_type="application/pdf", filename=name)

    if not os.path.exists("reports"):
        return JSONResponse({"detail": "No reports yet"}, status_code=404)
    candidates = [f for f in os.listdir("reports") if f.lower().endswith(".pdf")]
    if not candidates:
        return JSONResponse({"detail": "No reports yet"}, status_code=404)

    candidates.sort(key=lambda n: os.path.getmtime(os.path.join("reports", n)), reverse=True)
    latest = candidates[0]
    full = os.path.join("reports", latest)
    return FileResponse(full, media_type="application/pdf", filename=latest)




@app.get("/latest")
def get_latest():
    return latest_result or {"attack_type": "None", "confidence": 0.0}
