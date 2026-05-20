import base64
import io
from typing import Optional

import numpy as np
from PIL import Image
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
import torch

from models.efficientnet import IMAGE_SIZE


def generate_gradcam(model, tensor: torch.Tensor, image_bytes: bytes) -> Optional[str]:
    try:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE))
        original_image = np.asarray(pil_image).astype(np.float32) / 255.0

        with torch.no_grad():
            outputs = model(tensor)
            predicted_class = int(torch.softmax(outputs, dim=1)[0].argmax().item())

        target_layers = [model._blocks[-1]]
        targets = [ClassifierOutputTarget(predicted_class)]
        cam = GradCAM(model=model, target_layers=target_layers)
        grayscale_cam = cam(input_tensor=tensor, targets=targets)[0]

        visualization = show_cam_on_image(original_image, grayscale_cam, use_rgb=True)
        buffer = io.BytesIO()
        Image.fromarray(visualization).save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
    except Exception:
        return None
