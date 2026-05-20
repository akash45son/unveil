import torch
import torch.nn as nn
from efficientnet_pytorch import EfficientNet
import os

# ── Constants ────────────────────────────────────────────────────────────────
# Path to your trained model weights file
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'model.pth')

# EfficientNet-B0 expects images of this size
IMAGE_SIZE = 224

# Number of output classes: 0 = FAKE, 1 = REAL
NUM_CLASSES = 2

# ── Device Setup ─────────────────────────────────────────────────────────────
# Use GPU if available, otherwise CPU
# On Render free tier and most local machines, this will be CPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')


def load_model() -> nn.Module:
    """
    Builds EfficientNet-B0 architecture and loads your trained weights.
    Returns the model ready for inference (prediction).
    """

    # Step 1: Build EfficientNet-B0 with 2 output classes (REAL / FAKE)
    # 'advprop' means we use the standard pretrained weights structure
    model = EfficientNet.from_pretrained('efficientnet-b0', num_classes=NUM_CLASSES)

    # Step 2: Load your trained weights from model.pth
    # map_location ensures it loads correctly even without a GPU
    state_dict = torch.load(MODEL_PATH, map_location=device)

    # Step 3: Handle different save formats
    # Sometimes models are saved as {"model_state_dict": ...} wrapper
    # Other times the weights are saved directly
    if 'model_state_dict' in state_dict:
        state_dict = state_dict['model_state_dict']

    # Step 4: Load weights into the model
    # strict=False allows minor mismatches (e.g. if extra keys exist)
    model.load_state_dict(state_dict, strict=False)

    # Step 5: Move model to GPU or CPU
    model = model.to(device)

    # Step 6: Set to evaluation mode
    # This disables dropout and batch normalization training behavior
    model.eval()

    print(f"✅ Model loaded successfully on {device}")
    return model


# ── Singleton Pattern ─────────────────────────────────────────────────────────
# We load the model ONCE when the app starts, not on every request
# This is critical — loading takes ~2-3 seconds, requests should be instant
_model = None

def get_model() -> nn.Module:
    """
    Returns the already-loaded model.
    Loads it on first call, then reuses the same instance forever.
    This is called a 'singleton' pattern.
    """
    global _model
    if _model is None:
        _model = load_model()
    return _model