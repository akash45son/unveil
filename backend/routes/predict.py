import os
import tempfile
import time
from datetime import datetime
from io import BytesIO
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from routes.auth import get_current_user

router = APIRouter()
CLASS_LABELS = {0: "FAKE", 1: "REAL"}


def _get_db(request: Request):
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database is not ready")
    return db


def _predict_from_tensor(model, tensor):
    import numpy as np
    import torch

    with torch.no_grad():
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1)[0].detach().cpu().numpy()

    fake_prob = float(probabilities[0])
    real_prob = float(probabilities[1])
    predicted_index = int(np.argmax(probabilities))
    label = CLASS_LABELS[predicted_index]
    confidence = float(probabilities[predicted_index] * 100.0)
    return label, confidence, real_prob, fake_prob, probabilities


@router.post("/image")
async def predict_image(
    request: Request,
    current_user: dict = Depends(get_current_user),
    file: UploadFile = File(...),
):
    db = _get_db(request)
    from models.efficientnet import get_model
    from utils.gradcam import generate_gradcam
    from utils.preprocess import preprocess_image

    started_at = time.perf_counter()
    print(f"[predict_image] start filename={file.filename!r} size={getattr(file, 'size', None)}")

    step_started = time.perf_counter()
    model = get_model()
    print(f"[predict_image] model_ready elapsed={time.perf_counter() - step_started:.2f}s")

    step_started = time.perf_counter()
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty image file")
    print(f"[predict_image] file_read bytes={len(image_bytes)} elapsed={time.perf_counter() - step_started:.2f}s")

    step_started = time.perf_counter()
    tensor = preprocess_image(image_bytes)
    print(f"[predict_image] preprocess_done elapsed={time.perf_counter() - step_started:.2f}s")

    step_started = time.perf_counter()
    label, confidence, _, _, _ = _predict_from_tensor(model, tensor)
    print(f"[predict_image] prediction_done label={label} confidence={confidence:.2f} elapsed={time.perf_counter() - step_started:.2f}s")

    step_started = time.perf_counter()
    heatmap = generate_gradcam(model, tensor, image_bytes)
    print(f"[predict_image] gradcam_done has_heatmap={bool(heatmap)} elapsed={time.perf_counter() - step_started:.2f}s")

    prediction = {
        "user_id": current_user["id"],
        "label": label,
        "confidence": round(confidence, 2),
        "heatmap": heatmap,
        "filename": file.filename or "uploaded_image",
        "file_type": "image",
        "created_at": datetime.utcnow(),
    }
    step_started = time.perf_counter()
    await db["predictions"].insert_one(prediction)
    print(f"[predict_image] db_insert_done elapsed={time.perf_counter() - step_started:.2f}s total={time.perf_counter() - started_at:.2f}s")

    return {"label": label, "confidence": round(confidence, 2), "heatmap": heatmap}


@router.post("/video")
async def predict_video(
    request: Request,
    current_user: dict = Depends(get_current_user),
    file: UploadFile = File(...),
):
    db = _get_db(request)
    import cv2
    import numpy as np
    from PIL import Image

    from models.efficientnet import get_model
    from utils.gradcam import generate_gradcam
    from utils.preprocess import preprocess_image_pil

    model = get_model()
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    temp_path = None
    selected_frames = []

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            temp_file.write(await file.read())

        capture = cv2.VideoCapture(temp_path)
        if not capture.isOpened():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not read uploaded video")

        frame_index = 0
        while len(selected_frames) < 10:
            success, frame = capture.read()
            if not success:
                break

            if frame_index % 10 == 0:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_frame = Image.fromarray(frame_rgb)
                tensor = preprocess_image_pil(pil_frame)
                label, confidence, real_prob, fake_prob, probabilities = _predict_from_tensor(model, tensor)

                frame_buffer = BytesIO()
                pil_frame.save(frame_buffer, format="PNG")
                selected_frames.append(
                    {
                        "tensor": tensor,
                        "image_bytes": frame_buffer.getvalue(),
                        "probabilities": probabilities,
                        "fake_prob": fake_prob,
                    }
                )

            frame_index += 1

        capture.release()

        if not selected_frames:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No analyzable frames found in video")

        average_probabilities = np.mean([frame["probabilities"] for frame in selected_frames], axis=0)
        fake_prob = float(average_probabilities[0])
        real_prob = float(average_probabilities[1])
        predicted_index = int(np.argmax(average_probabilities))
        label = CLASS_LABELS[predicted_index]
        confidence = float(average_probabilities[predicted_index] * 100.0)

        most_fake_frame = max(selected_frames, key=lambda item: item["fake_prob"])
        heatmap = generate_gradcam(model, most_fake_frame["tensor"], most_fake_frame["image_bytes"])

        prediction = {
            "user_id": current_user["id"],
            "label": label,
            "confidence": round(confidence, 2),
            "heatmap": heatmap,
            "filename": file.filename or "uploaded_video",
            "file_type": "video",
            "created_at": datetime.utcnow(),
        }
        await db["predictions"].insert_one(prediction)

        return {
            "label": label,
            "confidence": round(confidence, 2),
            "heatmap": heatmap,
            "frames_analyzed": len(selected_frames),
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.get("/history")
async def prediction_history(request: Request, current_user: dict = Depends(get_current_user)):
    db = _get_db(request)
    cursor = (
        db["predictions"]
        .find({"user_id": current_user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(20)
    )
    history = await cursor.to_list(length=20)
    return {
        "predictions": [
            {
                "label": item.get("label"),
                "confidence": item.get("confidence"),
                "filename": item.get("filename"),
                "file_type": item.get("file_type"),
                "created_at": item.get("created_at"),
                "heatmap": item.get("heatmap"),
            }
            for item in history
        ]
    }
