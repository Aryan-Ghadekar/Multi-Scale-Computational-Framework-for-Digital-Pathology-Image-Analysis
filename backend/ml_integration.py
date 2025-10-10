import torch
import torch.nn as nn
from torchvision import transforms, models
from tqdm import tqdm
from scipy.linalg import pinv
import pytorch_lightning as pl
from skimage import filters
from typing import Dict, List, Any
import json
import numpy as np
import random
from PIL import Image
import openslide
from datetime import datetime

class PathMLService:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tile_size = 224
        self.tissue_threshold = 0.3
        self.low_res_scale = 2048
        self.model_path = "resnet18.ckpt"  # Update path as needed
        self.model = self._load_model()
        self.transform = self._get_transform()
        
        # Stain matrix for H&E decomposition
        self.stain_matrix = np.array([
            [0.644, 0.0326],
            [0.710, 0.873],
            [0.285, 0.488]
        ])

    def _load_model(self):
        """Load the trained tumor classification model"""
        class SimpleTumorClassifier(pl.LightningModule):
            def __init__(self, num_classes=2):
                super().__init__()
                self.backbone = models.resnet18(weights=None)
                in_features = self.backbone.fc.in_features
                self.backbone.fc = nn.Identity()
                self.classifier = nn.Linear(in_features, num_classes)

            def forward(self, x):
                return self.classifier(self.backbone(x))

        try:
            model = SimpleTumorClassifier.load_from_checkpoint(
                self.model_path, num_classes=2, map_location=self.device
            )
            print("✅ Loaded histopathology-pretrained checkpoint successfully!")
        except Exception as e:
            print(f"❌ Error loading checkpoint: {e}")
            print("Trying alternative loading method...")
            try:
                model = SimpleTumorClassifier(num_classes=2)
                checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=False)
                
                # Handle different checkpoint formats
                if 'state_dict' in checkpoint:
                    state_dict = checkpoint['state_dict']
                else:
                    state_dict = checkpoint
                
                # Remap keys if needed
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
                print("✅ Loaded checkpoint manually with key remapping!")
            except Exception as e2:
                print(f"❌ Failed to load checkpoint: {e2}")
                raise Exception("Could not load the trained model")

        model.eval()
        return model

    def _get_transform(self):
        """Get image transformation pipeline"""
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.Grayscale(num_output_channels=3),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def color_deconvolution(self, patch_rgb):
        """Deconvolve RGB to H and E optical density channels"""
        rgb_norm = patch_rgb.astype(np.float32) / 255.0 + 1e-8
        od = -np.log(rgb_norm)
        
        # Mask low OD pixels (background/white)
        od_sum = np.sum(od, axis=2)
        mask = od_sum < 0.01
        od_masked = od.copy()
        od_masked[mask] = 0.0
        
        w_pinv = pinv(self.stain_matrix)
        w_deconv = w_pinv.T
        
        od_stains = np.einsum('h w c, c s -> h w s', od_masked, w_deconv)
        
        H = np.clip(od_stains[:, :, 0], 0, None)
        E = np.clip(od_stains[:, :, 1], 0, None)
        
        # Normalize to [0,255]
        tissue_mask = ~mask
        if np.any(tissue_mask):
            H_norm = np.percentile(H[tissue_mask], 95)
            E_norm = np.percentile(E[tissue_mask], 95)
        else:
            H_norm = E_norm = 1.0
            
        H_scaled = np.clip((H / (H_norm + 1e-8)) * 255, 0, 255).astype(np.uint8)
        E_scaled = np.clip((E / (E_norm + 1e-8)) * 255, 0, 255).astype(np.uint8)
        
        H_scaled[mask] = 0
        E_scaled[mask] = 0
        
        return {'H': H_scaled, 'E': E_scaled}

    def analyze_wsi(self, wsi_path: str) -> Dict[str, Any]:
        """
        Main analysis function for Whole Slide Images (.tif files)
        Returns comprehensive analysis results
        """
        print(f"🔬 Starting analysis of: {wsi_path}")
        
        try:
            # Open WSI
            slide = openslide.OpenSlide(wsi_path)
            w, h = slide.dimensions
            print(f"📐 WSI size: {w} x {h}")

            # Generate low-res mask for tissue detection
            thumb = slide.get_thumbnail((self.low_res_scale, self.low_res_scale)).convert("RGB")
            thumb_np = np.array(thumb) / 255.0
            gray = np.mean(thumb_np, axis=2)
            thresh = filters.threshold_otsu(gray)
            mask_coords = np.argwhere(gray < thresh)
            random.shuffle(mask_coords)
            
            scale_x = w / self.low_res_scale
            scale_y = h / self.low_res_scale
            
            # Analyze tiles
            tile_results = []
            tile_count = 0
            max_tiles = 1000  # Limit for reasonable processing time
            
            for y_lowres, x_lowres in tqdm(mask_coords[:max_tiles * 4], desc="Analyzing tiles"):
                if tile_count >= max_tiles:
                    break
                    
                x, y = int(x_lowres * scale_x), int(y_lowres * scale_y)
                if x + self.tile_size > w or y + self.tile_size > h:
                    continue
                
                # Extract and process tile
                patch = slide.read_region((x, y), 0, (self.tile_size, self.tile_size)).convert("RGB")
                patch_rgb = np.array(patch)
                patch_np = patch_rgb / 255.0

                # Check tissue content
                gray_patch = np.mean(patch_np, axis=2)
                tissue_fraction = np.mean(gray_patch < 0.8)
                if tissue_fraction < self.tissue_threshold:
                    continue

                # Analyze tile with ML model
                try:
                    deconv = self.color_deconvolution(patch_rgb)
                    H_tile = deconv['H']
                    
                    # Convert to PIL and apply transform
                    H_pil = Image.fromarray(H_tile)
                    inp = self.transform(H_pil).unsqueeze(0).to(self.device)
                    
                    with torch.no_grad():
                        output = self.model(inp)
                        prob = torch.softmax(output, dim=1)
                        confidence, label = torch.max(prob, dim=1)
                    
                    # Store tile analysis
                    tile_results.append({
                        "x": x,
                        "y": y,
                        "width": self.tile_size,
                        "height": self.tile_size,
                        "tumor_confidence": float(confidence.item()),
                        "is_tumor": bool(label.item()),
                        "tissue_fraction": float(tissue_fraction)
                    })
                    tile_count += 1
                    
                except Exception as e:
                    print(f"❌ Error processing tile at ({x}, {y}): {e}")
                    continue
                # --- Generate a frontend-viewable image ---
                


            slide.close()

            # Generate comprehensive analysis results
            return self._generate_analysis_summary(tile_results, w, h)
            
        except Exception as e:
            print(f"❌ Error analyzing WSI: {e}")
            raise Exception(f"WSI analysis failed: {str(e)}")

    def _generate_analysis_summary(self, tile_results: List[Dict], width: int, height: int) -> Dict[str, Any]:
        """Generate comprehensive analysis summary from tile results"""
        if not tile_results:
            return self._get_empty_analysis()
        
        # Separate tumor & non-tumor tiles
        tumor_tiles = [tile for tile in tile_results if tile["is_tumor"]]
        non_tumor_tiles = [tile for tile in tile_results if not tile["is_tumor"]]
        all_confidences = [tile["tumor_confidence"] for tile in tile_results]

        # --- Formula Components ---
        mean_tumor_conf = np.mean([t["tumor_confidence"] for t in tumor_tiles]) if tumor_tiles else 0.0
        tumor_ratio = len(tumor_tiles) / len(tile_results) if len(tile_results) > 0 else 0.0
        mean_conf_all = np.mean(all_confidences) if all_confidences else 0.0

        # --- Lesion Probability Formula ---
        # P_lesion = (mean_tumor_conf × tumor_ratio) + (0.1 × mean_conf_all)
        lesion_probability = (mean_tumor_conf * tumor_ratio) + (0.1 * mean_conf_all)

        # Convert to %
        lesion_probability_percent = lesion_probability * 100
        overall_confidence = mean_conf_all * 100

        # Determine confidence level
        if overall_confidence >= 75:
            confidence_level = "High"
        elif overall_confidence >= 50:
            confidence_level = "Moderate"
        else:
            confidence_level = "Low"

        # Identify high-probability regions (Top 5)
        high_prob_regions = []
        top_tiles = sorted(tile_results, key=lambda t: t["tumor_confidence"], reverse=True)[:5]
        for i, tile in enumerate(top_tiles):
            if tile["tumor_confidence"] > 0.7:
                high_prob_regions.append({
                    "id": f"R{i+1}",
                    "name": f"Region {i+1}",
                    "confidence": round(tile["tumor_confidence"] * 100, 1),
                    "score": round(tile["tumor_confidence"], 3),
                    "bbox": [tile["x"], tile["y"], tile["x"] + tile["width"], tile["y"] + tile["height"]],
                    "features": ["high_tumor_confidence", "clear_cellular_structures"]
                })

        # --- Heatmap Data for Frontend ---
        heatmap_data = {
            "tile_size": self.tile_size,
            "width": width,
            "height": height,
            "tiles": [
                {
                    "x": tile["x"],
                    "y": tile["y"],
                    "confidence": tile["tumor_confidence"],
                    "is_tumor": tile["is_tumor"]
                }
                for tile in tile_results[:200]  # limit for frontend performance
            ]
        }

        # --- Return Structured Results ---
        return {
            "lesion_probability": round(lesion_probability_percent, 2),
            "overall_confidence": round(overall_confidence, 2),
            "confidence_level": confidence_level,
            "regions": high_prob_regions,
            
            "formula_details": {
                "mean_tumor_conf": round(mean_tumor_conf, 4),
                "tumor_ratio": round(tumor_ratio, 4),
                "mean_conf_all": round(mean_conf_all, 4),
                "formula": "P_lesion = (C̄_tumor × R_tumor) + (0.1 × C̄_all)"
            },
            "analysis_summary": self._generate_summary_text(
                lesion_probability_percent, confidence_level, len(tumor_tiles), len(tile_results)
            ),
            "metrics": {
                "total_tiles_analyzed": len(tile_results),
                "tumor_tiles_detected": len(tumor_tiles),
                "non_tumor_tiles": len(non_tumor_tiles),
                "average_tumor_confidence": round(mean_tumor_conf * 100, 1),
                "analysis_timestamp": datetime.now().isoformat()
            },
            "heatmap_data": heatmap_data
        }


    def _generate_summary_text(self, lesion_prob: float, confidence_level: str, tumor_count: int, total_tiles: int) -> str:
        """Generate human-readable analysis summary"""
        if confidence_level == "High":
            return f"High confidence analysis detected potential lesions in {lesion_prob:.1f}% of tissue regions. {tumor_count} out of {total_tiles} analyzed tiles show tumor characteristics with strong cellular evidence."
        elif confidence_level == "Moderate":
            return f"Moderate confidence analysis suggests {lesion_prob:.1f}% lesion probability. {tumor_count} suspicious regions identified out of {total_tiles} tiles. Manual review recommended for confirmation."
        else:
            return f"Low confidence analysis indicates {lesion_prob:.1f}% lesion probability. Limited tumor evidence found across {total_tiles} analyzed tissue regions. Expert evaluation advised."

    def _get_empty_analysis(self):
        """Return empty analysis when no tiles are found"""
        return {
            "lesion_probability": 0.0,
            "overall_confidence": 0.0,
            "confidence_level": "Low",
            "regions": [],
            "analysis_summary": "No analyzable tissue regions found in the image.",
            "metrics": {
                "total_tiles_analyzed": 0,
                "tumor_tiles_detected": 0,
                "non_tumor_tiles": 0,
                "average_tumor_confidence": 0,
                "analysis_timestamp": datetime.now().isoformat()
            },
            "heatmap_data": {
                "tile_size": self.tile_size,
                "width": 0,
                "height": 0,
                "tiles": []
            }
        }

