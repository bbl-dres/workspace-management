# Room Polygon & Label Extraction from Floor Plans — Python CV Research

> **Date**: 2026-02-25
> **Goal**: Evaluate Python computer vision solutions for extracting room polygons and room tag/label information from PDF, JPG, and PNG floor plan files.

---

## Table of Contents

1. [PDF Parsing Libraries](#1-pdf-parsing-libraries)
2. [Image Preprocessing](#2-image-preprocessing)
3. [Wall / Line Detection](#3-wall--line-detection)
4. [Room Segmentation / Polygon Extraction](#4-room-segmentation--polygon-extraction)
5. [OCR / Text Extraction](#5-ocr--text-extraction-for-room-labels)
6. [Deep Learning Approaches](#6-deep-learning-approaches)
7. [End-to-End Libraries & Commercial APIs](#7-end-to-end-libraries--commercial-apis)
8. [Recommended Pipeline](#8-recommended-practical-pipeline)
9. [Dependencies](#9-key-python-dependencies)
10. [Decision Tree](#10-pipeline-decision-tree)
11. [Sources](#11-sources)

---

## 1. PDF Parsing Libraries

### PyMuPDF (fitz / pymupdf) — Recommended

- **GitHub**: https://github.com/pymupdf/PyMuPDF
- **Docs**: https://pymupdf.readthedocs.io/

Binds to the MuPDF library. Can extract vector drawing paths (lines, curves, rects), embedded text, and rasterize pages to images at arbitrary DPI.

**Key methods for floor plans:**

| Method | Purpose |
|--------|---------|
| `page.get_drawings()` | Returns every vector path as a list of dicts with stroke/fill colors, line coords, and curve control points. The **single most valuable call** for vector-based PDFs (CAD-exported). |
| `page.get_text("dict")` | Returns every character with bounding box, font, size, and color. |
| `page.get_pixmap(dpi=300)` | Rasterizes the page to a PIL-compatible image for CV processing. |
| `page.cluster_drawings()` | Groups nearby vector graphics into bounding rectangles — useful for isolating individual drawings on a sheet. |

**Pros:** Extremely fast, excellent vector extraction, no external dependencies beyond the wheel.
**Cons:** Vector extraction only works well on PDFs that actually contain vector content (not scanned images).

```python
import pymupdf  # or: import fitz

doc = pymupdf.open("floorplan.pdf")
page = doc[0]

# Extract all vector drawings (lines, rects, curves)
paths = page.get_drawings()
for path in paths:
    for item in path["items"]:
        if item[0] == "l":    # line
            start, end = item[1], item[2]
        elif item[0] == "re":  # rectangle
            rect = item[1]

# Extract text with positions
text_dict = page.get_text("dict")
for block in text_dict["blocks"]:
    if "lines" in block:
        for line in block["lines"]:
            for span in line["spans"]:
                print(span["text"], span["bbox"])

# Rasterize for CV processing
pix = page.get_pixmap(dpi=300)
pix.save("floorplan.png")
```

### pdf2image

- **GitHub**: https://github.com/Belval/pdf2image

Wraps poppler to convert PDF pages to PIL Images. Simpler API for pure rasterization.

**Pros:** Dead simple, good quality rendering.
**Cons:** Requires poppler system dependency; no vector/text extraction.

```python
from pdf2image import convert_from_path
images = convert_from_path("floorplan.pdf", dpi=300)
images[0].save("page1.png")
```

### pdfplumber

- **GitHub**: https://github.com/jsvine/pdfplumber

Built on pdfminer.six; extracts individual chars, lines, rects, and curves as structured Python objects with coordinates.

**Key properties:** `.chars`, `.lines`, `.rects`, `.curves` — each returns a list of dicts with coordinates, colors, and dimensions.

**Pros:** Excellent for geometric primitives from vector PDFs; Pythonic API.
**Cons:** Slower than PyMuPDF; less capable for rasterization.

```python
import pdfplumber

with pdfplumber.open("floorplan.pdf") as pdf:
    page = pdf.pages[0]
    for line in page.lines:
        print(f"Line from ({line['x0']},{line['top']}) to ({line['x1']},{line['bottom']})")
    for char in page.chars:
        print(f"'{char['text']}' at ({char['x0']},{char['top']})")
```

---

## 2. Image Preprocessing

For scanned or rasterized floor plans, preprocessing is critical before detection.

| Technique | Function | Purpose |
|-----------|----------|---------|
| Grayscale conversion | `cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)` | Reduce to single channel |
| Gaussian blur | `cv2.GaussianBlur(gray, (5,5), 0)` | Remove high-frequency noise |
| Bilateral filter | `cv2.bilateralFilter(gray, 9, 75, 75)` | Smooth while preserving edges |
| Adaptive threshold | `cv2.adaptiveThreshold(...)` | Handle uneven lighting in scans |
| Otsu binarization | `cv2.threshold(gray, 0, 255, THRESH_BINARY_INV + THRESH_OTSU)` | Automatic threshold selection |
| Morphological close | `cv2.morphologyEx(binary, MORPH_CLOSE, kernel)` | Close small gaps in walls |
| Morphological open | `cv2.morphologyEx(binary, MORPH_OPEN, kernel)` | Remove small noise blobs |
| Dilation | `cv2.dilate(binary, kernel, iterations=1)` | Thicken thin wall lines |
| Skeletonization | `skimage.morphology.skeletonize(binary)` | Reduce walls to single-pixel centerlines |

```python
import cv2
import numpy as np
from skimage.morphology import skeletonize

img = cv2.imread("floorplan.png")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Denoise
blurred = cv2.GaussianBlur(gray, (5, 5), 0)

# Binarize (invert so walls are white/foreground)
_, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

# Close small gaps at doorways (critical for room segmentation)
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

# Remove small noise
kernel_small = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
cleaned = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel_small)

# Optional: skeletonize for centerline detection
skeleton = skeletonize(cleaned // 255).astype(np.uint8) * 255
```

> **Critical tip:** You typically want to **close the gaps at doors and windows** using morphological closing with a carefully sized kernel. This turns each room into a fully enclosed region that connected-component analysis can identify.

---

## 3. Wall / Line Detection

### Hough Transform (OpenCV)

- **Standard Hough** (`cv2.HoughLines`): Returns lines in (rho, theta). Good for dominant orientations.
- **Probabilistic Hough** (`cv2.HoughLinesP`): Returns line segment endpoints. More practical for walls.

```python
edges = cv2.Canny(blurred, 50, 150, apertureSize=3)

lines = cv2.HoughLinesP(edges, rho=1, theta=np.pi/180, threshold=80,
                         minLineLength=50, maxLineGap=10)

for line in lines:
    x1, y1, x2, y2 = line[0]
    cv2.line(img, (x1, y1), (x2, y2), (0, 0, 255), 2)
```

**Pros:** Simple, fast, well-understood. Works well for orthogonal plans.
**Cons:** Produces many fragmented segments; requires post-processing to merge collinear segments.

### Line Segment Detector (LSD)

```python
lsd = cv2.createLineSegmentDetector(0)
lines, widths, precs, nfas = lsd.detect(gray)
```

**Pros:** No threshold tuning; detects line segments directly without edge detection.
**Cons:** Can produce many short segments that need merging.

### Post-Processing: Merging Collinear Segments

After Hough or LSD, typical cleanup:
1. Filter lines by angle (keep horizontal and vertical for orthogonal plans)
2. Merge collinear segments that are close together
3. Extend segments to snap to intersections

---

## 4. Room Segmentation / Polygon Extraction

### Approach A: Connected Components (Simplest)

After binarizing and closing door gaps:

```python
# Invert so rooms (white space) become foreground
rooms_binary = cv2.bitwise_not(closed)

# Connected component labeling
num_labels, labels = cv2.connectedComponents(rooms_binary)

for label_id in range(1, num_labels):
    room_mask = (labels == label_id).astype(np.uint8) * 255
    area = cv2.countNonZero(room_mask)
    if area > min_room_area:
        contours, _ = cv2.findContours(room_mask, cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)
        polygon = contours[0]
```

**Pros:** Very fast, easy to implement.
**Cons:** Fails if walls have gaps not closed by morphology.

### Approach B: Contour Detection + Polygon Approximation

```python
contours, hierarchy = cv2.findContours(closed, cv2.RETR_TREE,
                                        cv2.CHAIN_APPROX_SIMPLE)

room_polygons = []
for contour in contours:
    area = cv2.contourArea(contour)
    if area > min_room_area:
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        room_polygons.append(approx)
```

### Approach C: Watershed Segmentation

Useful when rooms are not clearly separated:

```python
dist_transform = cv2.distanceTransform(rooms_binary, cv2.DIST_L2, 5)
_, markers = cv2.threshold(dist_transform, 0.5 * dist_transform.max(), 255, 0)
markers = markers.astype(np.uint8)
_, markers = cv2.connectedComponents(markers)
markers = markers + 1
markers[rooms_binary == 0] = 0

img_color = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
cv2.watershed(img_color, markers)
```

**Pros:** Can separate touching regions; handles imperfect wall closure.
**Cons:** More complex to tune; may over- or under-segment.

### Converting to Shapely Polygons

```python
from shapely.geometry import Polygon

shapely_rooms = []
for contour in room_polygons:
    pts = [(p[0][0], p[0][1]) for p in contour]
    if len(pts) >= 3:
        poly = Polygon(pts)
        if poly.is_valid and poly.area > min_area:
            shapely_rooms.append(poly)

# Clean up self-intersections
shapely_rooms = [p.buffer(0) for p in shapely_rooms]

# Simplify vertex count
shapely_rooms = [p.simplify(tolerance=2.0) for p in shapely_rooms]
```

Shapely provides `polygon.area`, `polygon.contains(point)`, `polygon.simplify()`, boolean operations, and support for polygons with holes.

---

## 5. OCR / Text Extraction for Room Labels

### Library Comparison

| Library | Accuracy | Speed | GPU Required | Best For |
|---------|----------|-------|--------------|----------|
| **PaddleOCR** | Highest overall | Fast | Optional | Production use, multilingual |
| **EasyOCR** | Good | Moderate | Optional | Quick prototyping, 80+ languages |
| **pytesseract** | Good (clean text) | Fastest (CPU) | No | Simple labels, well-printed text |
| **MMOCR** | Research-grade | Moderate | Yes | Rotated/curved text |

### PaddleOCR — Recommended

- **GitHub**: https://github.com/PaddlePaddle/PaddleOCR

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en')
results = ocr.ocr("floorplan.png", cls=True)

for line in results[0]:
    bbox = line[0]        # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
    text = line[1][0]     # recognized text
    conf = line[1][1]     # confidence
```

### EasyOCR

- **GitHub**: https://github.com/JaidedAI/EasyOCR

```python
import easyocr

reader = easyocr.Reader(['en'])
results = reader.readtext("floorplan.png")

for bbox, text, conf in results:
    print(f"'{text}' (conf={conf:.2f}) at {bbox}")
```

### pytesseract

```python
import pytesseract
from PIL import Image

data = pytesseract.image_to_data(Image.open("floorplan.png"),
                                  output_type=pytesseract.Output.DICT)
for i, text in enumerate(data['text']):
    if text.strip():
        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
```

### Associating Text Labels with Room Polygons

The critical linkage step — compute the centroid of each OCR bounding box, then test which room polygon contains it:

```python
from shapely.geometry import Point

def associate_labels_with_rooms(ocr_results, room_polygons):
    room_labels = {i: [] for i in range(len(room_polygons))}

    for bbox, text, conf in ocr_results:
        cx = sum(p[0] for p in bbox) / len(bbox)
        cy = sum(p[1] for p in bbox) / len(bbox)
        point = Point(cx, cy)

        for i, room_poly in enumerate(room_polygons):
            if room_poly.contains(point):
                room_labels[i].append({"text": text, "confidence": conf})
                break

    return room_labels
```

---

## 6. Deep Learning Approaches

### CubiCasa5k

- **GitHub**: https://github.com/CubiCasa/CubiCasa5k
- **Paper**: "CubiCasa5K: A Dataset and an Improved Multi-Task Model for Floorplan Image Analysis"
- **Dataset**: 5,000 floor plan images annotated with 80+ object categories
- **Architecture**: Multi-task model based on Raster-to-Vector with multi-task uncertainty loss
- **Output**: Semantic segmentation of walls, rooms (by type), doors, windows
- **Pros:** Largest public annotated floor plan dataset; pre-trained models available
- **Cons:** Primarily Finnish/European floor plan styles; PyTorch, can be heavy

### DeepFloorPlan

- **GitHub**: https://github.com/zlzeng/DeepFloorplan
- **TF2 port**: https://github.com/zcemycl/TF2DeepFloorplan (includes Docker, TFLite, Flask server, Colab)
- **Paper**: "Deep Floor Plan Recognition Using a Multi-Task Network with Room-Boundary-Guided Attention" (ICCV 2019)
- **Approach**: Multi-task network jointly predicting room types and boundaries with guided attention
- **Pros:** Strong accuracy; good at room-type classification
- **Cons:** Original in TF1; training data (R3D) may not be publicly available

### FloorplanTransformation (Raster-to-Vector)

- **GitHub**: https://github.com/art-programmer/FloorplanTransformation
- **Paper**: "Raster-to-Vector: Revisiting Floorplan Transformation" (ICCV 2017)
- **Approach**: Detects wall junctions as heatmaps, then uses integer programming to assemble junctions into wall lines
- **Output**: Vectorized floor plan with wall corners, segments, doors, windows
- **Performance**: ~90% precision and recall
- **Pros:** Produces clean vector output (not just segmentation masks)
- **Cons:** Original code in Torch7/Lua; integer programming step is complex

### Raster-to-Graph (2024 — State of the Art)

- **GitHub**: https://github.com/SizheHu/Raster-to-Graph
- **Paper**: "Raster-to-Graph: Floorplan Recognition via Autoregressive Graph Prediction with an Attention Transformer" (Eurographics 2024)
- **Approach**: Visual attention Transformer to autoregressively predict wall junctions and segments as a structural graph
- **Dataset**: 10,000+ real-world residential floor plans
- **Pros:** State-of-the-art results; modern Transformer architecture
- **Cons:** Very recent; may require significant compute

### Other Notable Projects

| Project | GitHub | Approach |
|---------|--------|----------|
| **FloorPlanParser** | https://github.com/TINY-KE/FloorPlanParser | End-to-end vectorization via REST API |
| **U-Net Room Segmentation** | https://github.com/ozturkoktay/floor-plan-room-segmentation | U-Net + ResNet encoder for semantic segmentation |
| **YOLOv8 Floor Plan** | https://github.com/sanatladkat/floor-plan-object-detection | YOLOv8 for columns, walls, doors, windows |

---

## 7. End-to-End Libraries & Commercial APIs

### Open Source Summary

| Project | Framework | Approach | Output |
|---------|-----------|----------|--------|
| CubiCasa5k | PyTorch | Multi-task segmentation | Room masks + types |
| TF2DeepFloorplan | TF2 | Multi-task network | Room masks + boundaries |
| FloorplanTransformation | PyTorch + IP | Junction detection + assembly | Vector walls, doors, windows |
| FloorPlanParser | Python | End-to-end vectorization | Vectorized floor plan via API |
| Raster-to-Graph | Python | Transformer autoregressive | Structural graph |
| AFPlan | Java | Morphology + connected components | Room locations (CSV/SVG/DXF) |

### Commercial / API Solutions

| Service | Description |
|---------|-------------|
| **Archilogic** (archilogic.com) | Spatial data platform with Floor Plan SDK/API. Microsoft Places partner. Interactive rendering and space management. |
| **Roboflow** (roboflow.com) | Platform for training custom floor plan detection models. Smart Polygon annotation, pre-trained models, hosted inference API. |
| **magicplan** | Mobile app for scanning rooms into 2D/3D floor plans (LiDAR-based). |
| **Google Cloud Vision API / Document AI** | General-purpose OCR and object detection. Text extraction but not specialized for architectural drawings. |
| **Kreo** (kreo.net) | Commercial floor plan recognition with dual I-OCR and CV pipelines for construction takeoff. |

---

## 8. Recommended Practical Pipeline

### Step 0: PDF Ingestion

```python
import pymupdf

doc = pymupdf.open("floorplan.pdf")
page = doc[0]

# Try vector extraction first (works for CAD-exported PDFs)
drawings = page.get_drawings()
text_blocks = page.get_text("dict")

if len(drawings) > 50:  # Likely a vector PDF
    walls = extract_walls_from_vectors(drawings)
    labels = extract_text_with_positions(text_blocks)
else:
    # Rasterize for CV processing
    pix = page.get_pixmap(dpi=300)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
```

### Step 1: Image Preprocessing

```python
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
blurred = cv2.GaussianBlur(gray, (3, 3), 0)
_, binary = cv2.threshold(blurred, 0, 255,
                           cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

# Remove text/annotations (small connected components)
num_labels, labels_cc, stats, centroids = cv2.connectedComponentsWithStats(binary)
for i in range(1, num_labels):
    area = stats[i, cv2.CC_STAT_AREA]
    w = stats[i, cv2.CC_STAT_WIDTH]
    h = stats[i, cv2.CC_STAT_HEIGHT]
    if area < 200 or (w < 10 and h < 10):
        binary[labels_cc == i] = 0

# Close door/window gaps
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
```

### Step 2: Room Segmentation

```python
rooms_fg = cv2.bitwise_not(closed)
num_rooms, room_labels = cv2.connectedComponents(rooms_fg)

room_polygons = []
for label_id in range(1, num_rooms):
    mask = (room_labels == label_id).astype(np.uint8) * 255
    area = cv2.countNonZero(mask)
    if area < 500:
        continue

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        epsilon = 0.01 * cv2.arcLength(contours[0], True)
        approx = cv2.approxPolyDP(contours[0], epsilon, True)
        pts = [(p[0][0], p[0][1]) for p in approx]
        if len(pts) >= 3:
            poly = Polygon(pts).buffer(0)
            if poly.is_valid and poly.area > 500:
                room_polygons.append(poly)
```

### Step 3: OCR for Room Labels

```python
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en')
ocr_results = ocr.ocr("floorplan.png", cls=True)

labels = []
for line in ocr_results[0]:
    bbox = line[0]
    text = line[1][0]
    conf = line[1][1]
    cx = sum(p[0] for p in bbox) / 4
    cy = sum(p[1] for p in bbox) / 4
    labels.append({"text": text, "confidence": conf,
                    "centroid": Point(cx, cy), "bbox": bbox})
```

### Step 4: Associate Labels with Rooms

```python
room_data = []
for i, poly in enumerate(room_polygons):
    room_info = {
        "id": i,
        "polygon": poly,
        "area": poly.area,
        "centroid": poly.centroid,
        "labels": []
    }
    for label in labels:
        if poly.contains(label["centroid"]):
            room_info["labels"].append(label["text"])
    room_data.append(room_info)
```

### Step 5 (Optional): Deep Learning Enhancement

If the classical pipeline produces poor results, substitute Steps 1-2 with a deep learning model:

```python
import torch

model = torch.load("cubicasa_model.pth")
model.eval()

input_tensor = preprocess(img)

with torch.no_grad():
    room_seg, boundary_seg = model(input_tensor)

room_classes = torch.argmax(room_seg, dim=1).squeeze().numpy()
for class_id in np.unique(room_classes):
    if class_id == 0:
        continue
    mask = (room_classes == class_id).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)
    # Convert contours to Shapely polygons...
```

---

## 9. Key Python Dependencies

```
# Core
pip install pymupdf opencv-python-headless scikit-image shapely numpy pillow matplotlib

# OCR (pick one)
pip install paddlepaddle paddleocr
pip install easyocr
pip install pytesseract          # also needs Tesseract system binary

# Optional PDF rasterization
pip install pdf2image            # also needs poppler system binary

# Deep learning (if using DL models)
pip install torch torchvision
```

---

## 10. Pipeline Decision Tree

```
Input PDF/Image
    |
    v
Is it a vector PDF? ─── YES ──> Extract lines/text directly via PyMuPDF
    |                            (best accuracy, no CV needed)
    NO
    |
    v
Is it a clean, orthogonal ─── YES ──> Classical CV pipeline:
floor plan?                           Binarize -> Close gaps ->
    |                                 Connected components ->
    NO                                Contour polygons + OCR
    |
    v
Use deep learning model:
  CubiCasa5k (segmentation) or
  FloorplanTransformation (vectorization) or
  Raster-to-Graph (graph prediction)
  + OCR (PaddleOCR) for labels
```

### Summary of Recommendations

| Scenario | Best Approach |
|----------|---------------|
| **Vector PDFs** (CAD-exported) | PyMuPDF `get_drawings()` + `get_text()` — no CV needed |
| **Clean raster images** | Classical OpenCV pipeline (binarize, morph close, connected components) |
| **OCR for labels** | PaddleOCR (best accuracy-to-ease ratio) + centroid-in-polygon matching |
| **Complex/noisy plans** | CubiCasa5k or TF2DeepFloorplan for semantic segmentation |
| **Production vectorization** | FloorplanTransformation or Raster-to-Graph |
| **Geometry operations** | Shapely for polygon validation, simplification, area, point-in-polygon, booleans |

---

## 11. Sources

- [PyMuPDF Vector Graphics Extraction](https://artifex.com/blog/extracting-and-creating-vector-graphics-in-a-pdf-using-python-pymupdf)
- [PyMuPDF Documentation](https://pymupdf.readthedocs.io/en/latest/tutorial.html)
- [pdfplumber GitHub](https://github.com/jsvine/pdfplumber)
- [CubiCasa5k GitHub](https://github.com/CubiCasa/CubiCasa5k)
- [DeepFloorPlan GitHub](https://github.com/zlzeng/DeepFloorplan)
- [TF2DeepFloorplan GitHub](https://github.com/zcemycl/TF2DeepFloorplan)
- [FloorplanTransformation GitHub](https://github.com/art-programmer/FloorplanTransformation)
- [Raster-to-Graph GitHub](https://github.com/SizheHu/Raster-to-Graph)
- [FloorPlanParser GitHub](https://github.com/TINY-KE/FloorPlanParser)
- [Floor Plan Room Segmentation (U-Net)](https://github.com/ozturkoktay/floor-plan-room-segmentation)
- [YOLOv8 Floor Plan Object Detection](https://github.com/sanatladkat/floor-plan-object-detection)
- [Roboflow Floor Plan Analysis](https://blog.roboflow.com/floor-plan-analysis-computer-vision/)
- [Roboflow Floor Plan Datasets](https://universe.roboflow.com/search?q=class:floorplan)
- [Floor Plans with Python and Shapely](https://leancrew.com/all-this/2020/02/floor-plans-with-python-and-shapely/)
- [Shapely Documentation](https://shapely.readthedocs.io/en/stable/manual.html)
- [OpenCV Hough Line Transform](https://docs.opencv.org/3.4/d9/db0/tutorial_hough_lines.html)
- [OpenCV Watershed Algorithm](https://docs.opencv.org/4.x/d3/db4/tutorial_py_watershed.html)
- [scikit-image Skeletonize](https://scikit-image.org/docs/0.25.x/auto_examples/edges/plot_skeleton.html)
- [OCR Comparison: PaddleOCR vs EasyOCR vs Tesseract](https://www.plugger.ai/blog/comparison-of-paddle-ocr-easyocr-kerasocr-and-tesseract-ocr)
- [Deep Learning Text Detection on Floor Plans](https://www.sciencedirect.com/science/article/abs/pii/S0926580523004168)
- [Kreo Floor Plan Recognition Technologies](https://www.kreo.net/news-2d-takeoff/floor-plan-recognition-technologies)
- [Archilogic Developer Docs](https://developers.archilogic.com/)
- [Wall Polygon Retrieval Research Paper (U. Chile)](https://repositorio.uchile.cl/bitstream/handle/2250/196842/Wall-polygon-retrieval-from-architectural-floor-plan-images-using-vectorizacion-and-Deep-Learning-methods.pdf)
- [CVPR 2021: Residential Floor Plan Recognition and Reconstruction](https://openaccess.thecvf.com/content/CVPR2021/papers/Lv_Residential_Floor_Plan_Recognition_and_Reconstruction_CVPR_2021_paper.pdf)
