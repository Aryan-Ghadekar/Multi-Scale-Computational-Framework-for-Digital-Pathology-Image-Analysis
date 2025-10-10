import os
import openslide
import numpy as np
from PIL import Image
import random
import torch
import torch.nn as nn
from torchvision import transforms, models
from tqdm import tqdm
import matplotlib.pyplot as plt
from scipy.linalg import pinv
import pytorch_lightning as pl
from skimage import filters 

# ---------------- CONFIG ----------------
WSI_PATH = "C:\\Users\\gawan\\OneDrive\\Desktop\\fusionHackathon\\Fusion-Hackathon-Digital-Pathology-Image-Analysis-Platform\\backend\\tumor_090.tif"
TILES_DIR = "tiles"
TILE_SIZE = 224
MAX_TILES = 10000
TISSUE_THRESHOLD = 0.3  # Fraction of non-background pixels
LOW_RES_SCALE = 2048
MODEL_PATH = "tenpercent_resnet18.ckpt"

os.makedirs(TILES_DIR, exist_ok=True)
os.makedirs(os.path.join(TILES_DIR, 'raw'), exist_ok=True)  # Subdir for raw tiles
os.makedirs(os.path.join(TILES_DIR, 'H'), exist_ok=True)  # Hematoxylin grayscale tiles
os.makedirs(os.path.join(TILES_DIR, 'E'), exist_ok=True)  # Eosin grayscale tiles

# ---------------- Ruifrok Color Deconvolution for H&E (Replaces Macenko to Fix Purple Artifacts) ----------------
# Standard stain matrix for H&E (rows: RGB channels; columns: H, E)

stain_matrix = np.array([
    [0.644, 0.0326],  # R: H, E
    [0.710, 0.873],   # G: H, E
    [0.285, 0.488]    # B: H, E
])  # Shape: (3, 2)

def color_deconvolution(patch_rgb):
    """
    Deconvolve RGB to H and E optical density (OD) channels.
    Input: patch_rgb uint8 [0-255] (H,W,3)
    Output: {'H': uint8 grayscale [0-255], 'E': uint8 grayscale [0-255]}
    Higher values = stronger stain (nuclei in H, cytoplasm in E).
    This fixes purple artifacts by avoiding RGB reconstruction [web:39][web:43].
    """
    # Normalize to [0,1] and compute OD
    rgb_norm = patch_rgb.astype(np.float32) / 255.0 + 1e-8
    od = -np.log(rgb_norm)
    
    # Mask low OD pixels (background/white)
    od_sum = np.sum(od, axis=2)
    mask = od_sum < 0.01
    od_masked = od.copy()
    od_masked[mask] = 0.0
    
    # FIXED: Deconvolution matrix for C = OD @ pinv(S).T (batched matmul)
    # pinv(S) (2,3), pinv(S).T (3,2) for (H,W,3) @ (3,2) -> (H,W,2)
    w_pinv = pinv(stain_matrix)  # (3,2) -> (2,3)
    w_deconv = w_pinv.T  # (3,2)
    
    # Apply: od_stains = od_masked @ w_deconv
    od_stains = np.einsum('h w c, c s -> h w s', od_masked, w_deconv)  # (H,W,3) @ (3,2) -> (H,W,2)
    
    # Extract H (stain 0) and E (stain 1); clip negatives
    H = np.clip(od_stains[:, :, 0], 0, None)
    E = np.clip(od_stains[:, :, 1], 0, None)
    
    # Normalize to [0,255] using 95th percentile on non-masked pixels for better contrast
    tissue_mask = ~mask
    if np.any(tissue_mask):
        H_norm = np.percentile(H[tissue_mask], 95)
        E_norm = np.percentile(E[tissue_mask], 95)
    else:
        H_norm = E_norm = 1.0
    H_scaled = np.clip((H / (H_norm + 1e-8)) * 255, 0, 255).astype(np.uint8)
    E_scaled = np.clip((E / (E_norm + 1e-8)) * 255, 0, 255).astype(np.uint8)
    
    # Set background to 0
    H_scaled[mask] = 0
    E_scaled[mask] = 0
    
    return {'H': H_scaled, 'E': E_scaled}

# ---------------- OPEN WSI ----------------
slide = openslide.OpenSlide(WSI_PATH)
w, h = slide.dimensions
print(f"WSI size: {w} x {h}")

# ---------------- IMPROVED LOW-RES MASK ----------------
thumb = slide.get_thumbnail((LOW_RES_SCALE, LOW_RES_SCALE)).convert("RGB")
thumb_np = np.array(thumb) / 255.0
gray = np.mean(thumb_np, axis=2)
thresh = filters.threshold_otsu(gray)
mask_coords = np.argwhere(gray < thresh)
random.shuffle(mask_coords)
scale_x = w / LOW_RES_SCALE
scale_y = h / LOW_RES_SCALE
print(f"Found {len(mask_coords)} potential tissue coordinates in low-res thumbnail.")

# ---------------- EXTRACT TILES ----------------
tile_paths_H, tile_paths_E, tile_count = [], [], 0
skipped = 0
for y_lowres, x_lowres in tqdm(mask_coords[:MAX_TILES * 4], desc="Extracting tiles"):
    if tile_count >= MAX_TILES:
        break
    x, y = int(x_lowres * scale_x), int(y_lowres * scale_y)
    if x + TILE_SIZE > w or y + TILE_SIZE > h:
        continue
    
    # Extract raw patch
    patch = slide.read_region((x, y), 0, (TILE_SIZE, TILE_SIZE)).convert("RGB")
    patch_rgb = np.array(patch)  # uint8 [0-255]
    patch_np = patch_rgb / 255.0  # For tissue check
    
    # Tissue fraction: Dark/colored pixels (non-white background)
    gray_patch = np.mean(patch_np, axis=2)
    tissue_fraction = np.mean(gray_patch < 0.8)
    if tissue_fraction < TISSUE_THRESHOLD:
        skipped += 1
        continue
    
    # Save raw RGB
    raw_tile_path = os.path.join(TILES_DIR, 'raw', f"raw_tile_{tile_count:04d}.png")
    Image.fromarray(patch_rgb).save(raw_tile_path)
    
    # Deconvolve to H/E (fixes purple by separating channels)
    deconv = color_deconvolution(patch_rgb)
    H_tile = deconv['H']
    E_tile = deconv['E']
    
    # Save grayscale tiles
    H_path = os.path.join(TILES_DIR, 'H', f"H_tile_{tile_count:04d}.png")
    E_path = os.path.join(TILES_DIR, 'E', f"E_tile_{tile_count:04d}.png")
    Image.fromarray(H_tile).save(H_path)
    Image.fromarray(E_tile).save(E_path)
    tile_paths_H.append(H_path)
    tile_paths_E.append(E_path)
    tile_count += 1

print(f"Saved {tile_count} H/E tiles (and raw) in {TILES_DIR} (skipped {skipped})")

# Visualize samples: Raw, H, E for first 4 tiles
if tile_count > 0:
    fig, axs = plt.subplots(3, 4, figsize=(16, 12))
    for i in range(min(4, tile_count)):
        raw_img = np.array(Image.open(os.path.join(TILES_DIR, 'raw', f"raw_tile_{i:04d}.png")))
        H_img = np.array(Image.open(os.path.join(TILES_DIR, 'H', f"H_tile_{i:04d}.png")))
        E_img = np.array(Image.open(os.path.join(TILES_DIR, 'E', f"E_tile_{i:04d}.png")))
        
        axs[0, i].imshow(raw_img); axs[0, i].set_title(f"Raw Tile {i}"); axs[0, i].axis('off')
        axs[1, i].imshow(H_img, cmap='gray'); axs[1, i].set_title(f"H (Nuclei) Tile {i}"); axs[1, i].axis('off')
        axs[2, i].imshow(E_img, cmap='gray'); axs[2, i].set_title(f"E (Cytoplasm) Tile {i}"); axs[2, i].axis('off')
    plt.tight_layout()
    plt.savefig(os.path.join(TILES_DIR, 'sample_H_E_tiles.png'), dpi=150, bbox_inches='tight')
    plt.show()

# ---------------- TRANSFORM (for H/E: Grayscale to 3-channel for RGB models) ----------------
device = "cuda" if torch.cuda.is_available() else "cpu"
print("Using device:", device)
transform_HE = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.Grayscale(num_output_channels=3),  # Stack grayscale to RGB for ResNet
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# ---------------- MODEL ----------------
class SimpleTumorClassifier(pl.LightningModule):
    def __init__(self, num_classes=2):
        super().__init__()
        self.backbone = models.resnet18(weights=None)
        in_features = self.backbone.fc.in_features
        self.backbone.fc = nn.Identity()
        self.classifier = nn.Linear(in_features, num_classes)

    def forward(self, x):
        return self.classifier(self.backbone(x))

# Load model (improved remapping for compatibility)
try:
    model = SimpleTumorClassifier.load_from_checkpoint(MODEL_PATH, num_classes=2, map_location=device)
    print("Loaded histopathology-pretrained checkpoint successfully!")
except Exception as e:
    print(f"Error loading checkpoint with load_from_checkpoint: {e}")
    print("Trying alternative loading method...")
    try:
        model = SimpleTumorClassifier(num_classes=2)
        checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
        if 'state_dict' in checkpoint:
            state_dict = checkpoint['state_dict']
        else:
            state_dict = checkpoint
        
        new_state_dict = {}
        for k, v in state_dict.items():
            if k.startswith('model.resnet.') and 'fc.' not in k:
                new_k = 'backbone.' + k[12:]
                new_state_dict[new_k] = v
            elif k.startswith('model.resnet.fc.'):
                if k.endswith('.3.weight') or k.endswith('.3.bias'):
                    new_k = 'classifier.' + k[-10:] if k.endswith('weight') else 'classifier.' + k[-5:]
                    new_state_dict[new_k] = v
            else:
                new_state_dict[k] = v
                
        model.load_state_dict(new_state_dict, strict=False)
        print("Loaded checkpoint manually with key remapping!")
    except Exception as e2:
        print(f"Failed to load checkpoint: {e2}")
        print("Using randomly initialized model...")
        model = SimpleTumorClassifier(num_classes=2)

model.eval()
model.to(device)

# ---------------- PREDICTION (Example on H Tiles; Duplicate for E) ----------------
results = []
tile_paths = tile_paths_H  # Use H for nuclear focus; or tile_paths_E for stroma
for tile_path in tqdm(tile_paths[:100], desc="Predicting H tiles"):  # Limit for demo
    try:
        img = Image.open(tile_path).convert("L")  # Load as grayscale
        inp = transform_HE(img).unsqueeze(0).to(device)
        with torch.no_grad():
            output = model(inp)
            prob = torch.softmax(output, dim=1)
            confidence, label = torch.max(prob, dim=1)
        results.append({"tile": os.path.basename(tile_path), "label": label.item(), "confidence": confidence.item()})
    except Exception as e:
        print(f"Error on {tile_path}: {e}")

# ---------------- RESULTS & HEATMAP ----------------
print("Sample results:")
for r in results[:5]:
    print(f"Tile: {r['tile']}, Label: {r['label']}, Confidence: {r['confidence']:.3f}")

if results:
    confidences = [r["confidence"] for r in results]
    num_tiles = len(confidences)
    heatmap_size = int(np.ceil(np.sqrt(num_tiles)))
    pad_len = heatmap_size ** 2 - num_tiles
    confidences_padded = confidences + [0.0] * pad_len
    heatmap = np.array(confidences_padded).reshape(heatmap_size, heatmap_size)

    plt.figure(figsize=(10, 8))
    plt.imshow(heatmap, cmap="hot", interpolation='nearest')
    plt.title("Tumor Confidence Heatmap (H Tiles)")
    plt.colorbar(label='Confidence')
    plt.tight_layout()
    plt.savefig('tumor_heatmap.png', dpi=150, bbox_inches='tight')
    plt.show()
    # ---------------- LESION PROBABILITY CALCULATION ----------------
import numpy as np
import matplotlib.pyplot as plt

# Collect confidences and labels from your results list
tumor_probs = [r["confidence"] for r in results if r["label"] == 1]
normal_probs = [r["confidence"] for r in results if r["label"] == 0]

# Mean tumor tile confidence
mean_tumor_conf = np.mean(tumor_probs) if len(tumor_probs) > 0 else 0.0

# Proportion of tiles predicted as tumor
tumor_ratio = len(tumor_probs) / len(results) if len(results) > 0 else 0.0

# Final lesion probability formula
# P_lesion = (mean_tumor_conf × tumor_ratio) + (mean_conf × 0.1)
mean_conf = np.mean([r["confidence"] for r in results])
lesion_probability = (mean_tumor_conf * tumor_ratio) + (mean_conf * 0.1)

# --- Print Step-by-Step Breakdown ---
print("\n===== Lesion Probability Calculation =====")
print(f"Mean Tumor Tile Confidence (C̄_tumor): {mean_tumor_conf:.4f}")
print(f"Tumor Tile Ratio (R_tumor): {tumor_ratio:.4f}")
print(f"Mean Overall Confidence (C̄_all): {mean_conf:.4f}")
print(f"\nFormula: P_lesion = (C̄_tumor × R_tumor) + (0.1 × C̄_all)")
print(f"Calculated Lesion Probability: {lesion_probability:.4f}")
print("==========================================\n")

# --- Visualization ---
plt.figure(figsize=(6, 1.5))
plt.barh(['Lesion Probability'], [lesion_probability], color='crimson')
plt.xlim(0, 1)
plt.xlabel('Probability')
plt.title('Overall Lesion Probability')
plt.tight_layout()
plt.savefig('lesion_probability_bar.png', dpi=150, bbox_inches='tight')
plt.show()


slide.close()
