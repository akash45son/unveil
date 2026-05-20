import torch
import numpy as np
from PIL import Image
from torchvision import transforms
import io
from models.efficientnet import IMAGE_SIZE, device


# ── Image Transform Pipeline ──────────────────────────────────────────────────
# This is the EXACT same transform used during training
# Using different values here would break predictions
transform = transforms.Compose([
    # Resize to 224x224 (EfficientNet-B0 input size)
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    # Convert to tensor: changes shape from (H, W, C) to (C, H, W)
    # and scales pixel values from [0, 255] to [0.0, 1.0]
    transforms.ToTensor(),

    # Normalize using ImageNet mean and std values
    # These are the standard values used when EfficientNet was pretrained
    # Formula: output = (input - mean) / std
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


def preprocess_image(image_bytes: bytes) -> torch.Tensor:
    """
    Takes raw image bytes (from an uploaded file) and converts
    them into a tensor ready for the model.

    Args:
        image_bytes: Raw bytes of the uploaded image file

    Returns:
        torch.Tensor of shape [1, 3, 224, 224] on the correct device
    """

    # Step 1: Open image from bytes using PIL
    # io.BytesIO wraps raw bytes so PIL can read them like a file
    image = Image.open(io.BytesIO(image_bytes))

    # Step 2: Convert to RGB
    # Some images are RGBA (PNG with transparency) or grayscale (L)
    # The model expects exactly 3 channels (R, G, B)
    image = image.convert('RGB')

    # Step 3: Apply the transform pipeline defined above
    # Result shape: [3, 224, 224]
    tensor = transform(image)

    # Step 4: Add batch dimension
    # Model expects [batch_size, channels, height, width]
    # unsqueeze(0) adds a dimension at position 0: [3,224,224] → [1,3,224,224]
    tensor = tensor.unsqueeze(0)

    # Step 5: Move tensor to the same device as the model (CPU or GPU)
    tensor = tensor.to(device)

    return tensor


def preprocess_image_pil(pil_image: Image.Image) -> torch.Tensor:
    """
    Same as preprocess_image but accepts a PIL Image directly.
    Used during video processing where we extract frames as PIL images.

    Args:
        pil_image: A PIL Image object

    Returns:
        torch.Tensor of shape [1, 3, 224, 224] on the correct device
    """

    # Convert to RGB in case it's not already
    image = pil_image.convert('RGB')

    # Apply transforms and add batch dimension
    tensor = transform(image).unsqueeze(0).to(device)

    return tensor


def tensor_to_numpy(tensor: torch.Tensor) -> np.ndarray:
    """
    Converts a PyTorch tensor back to a numpy array.
    Used by Grad-CAM to process the heatmap output.

    Args:
        tensor: Any PyTorch tensor

    Returns:
        numpy array
    """
    # .detach() stops gradient tracking (not needed for inference)
    # .cpu() moves from GPU to CPU if needed
    # .numpy() converts to numpy array
    return tensor.detach().cpu().numpy()