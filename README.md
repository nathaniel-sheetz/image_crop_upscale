# Frame TV Image Processor

A web application for cropping and upscaling images to specific resolutions for Samsung Frame TVs.

## Two Modes Available

This application offers two processing modes to suit your needs:

### Server Mode (Recommended for Best Quality)
- Uses Python Pillow with Lanczos resampling
- Professional-grade image quality
- Requires Flask installation
- Best for: Quality-critical projects

### Browser Mode (No Installation Required)
- Processes images entirely in your browser
- Uses Canvas API with high-quality smoothing
- Works offline, no server needed
- Your images never leave your device
- Best for: Quick access, privacy, sharing

**Choose your mode** when you start the application, or deploy the browser version standalone.

## Features

- **Image Upload**: Drag-and-drop or click to upload images (PNG, JPG, JPEG, WEBP, BMP)
- **Preset Resolutions**: Quick selection for 4K (3840×2160) and Full HD (1920×1080)
- **Interactive Cropping**: Drag and resize crop box with locked aspect ratio
- **Letterbox / Pillarbox Mode**: Toggle free-aspect cropping with automatic black bars to fill the frame
- **Smart Upscaling**: High-quality Lanczos resampling for crisp results
- **Instant Download**: Process and download your optimized image

## Tech Stack

### Server Mode
- **Backend**: Flask (Python)
- **Image Processing**: Pillow with Lanczos resampling
- **Frontend**: HTML/CSS/JavaScript
- **Crop Tool**: Cropper.js

### Browser Mode
- **Processing**: Canvas API with high-quality smoothing
- **Frontend**: Pure HTML/CSS/JavaScript
- **Crop Tool**: Cropper.js
- **No backend required**

## Mode Comparison

| Feature | Server Mode | Browser Mode |
|---------|-------------|--------------|
| **Setup Required** | Flask + Python | None |
| **Image Quality** | ⭐⭐⭐⭐⭐ Excellent (Lanczos) | ⭐⭐⭐⭐ Very Good (Canvas) |
| **Processing Speed** | Fast | Fast |
| **Privacy** | Local server | Never leaves browser |
| **Offline Use** | No | Yes |
| **Hosting** | Requires server | Static (free) |
| **Best For** | Professional quality | Convenience & privacy |

## Installation

1. **Install Python dependencies**:
```bash
pip install -r requirements.txt
```

## Running the Application

### Option 1: Run with Flask (Both Modes)

1. **Start the Flask server**:
```bash
python app.py
```

2. **Open your browser** and navigate to:
```
http://localhost:5000
```

3. **Choose your mode**:
   - Click "Server Mode" for Lanczos quality processing
   - Click "Browser Mode" for client-side processing

### Option 2: Browser Mode Only (No Installation)

1. **Open directly in browser**:
```bash
# Open client-side/index.html in your browser
# Or deploy to GitHub Pages/Netlify (see DEPLOYMENT.md)
```

2. **All processing happens locally** - no server required!

## Usage

1. **Upload an Image**: Click or drag-and-drop your image
2. **Select Resolution**: Choose 4K or Full HD preset
3. **Crop**: Drag and resize the crop box to select your desired area
   - **Optional**: Enable "Allow blank space (letterbox)" to crop freely without the 16:9 constraint. Black bars will be added to fill the frame while preserving your crop's aspect ratio.
4. **Process**: Click "Process & Upscale Image"
5. **Download**: Save your optimized image

## Project Structure

```
image_crop_upscale/
├── app.py                      # Flask backend
├── requirements.txt            # Python dependencies
├── templates/
│   ├── mode_selector.html     # Landing page (choose mode)
│   └── index.html             # Server mode HTML
├── static/
│   ├── css/
│   │   └── style.css          # Server mode styles
│   └── js/
│       └── app.js             # Server mode JavaScript
├── client-side/               # Browser mode (standalone)
│   ├── index.html             # Client-side HTML
│   ├── css/
│   │   └── style.css          # Client-side styles
│   └── js/
│       └── app-client.js      # Canvas-based processing
├── tests/                     # Test suite
├── uploads/                   # Temporary uploaded images (server mode)
└── processed/                 # Processed images (server mode)
```

## How It Works

1. **Upload**: User uploads an image via drag-and-drop or file picker
2. **Preview**: Image is displayed with Cropper.js overlay
3. **Select**: User chooses target resolution (locks aspect ratio to 16:9 by default)
4. **Crop**: User positions and sizes the crop box
   - With letterbox mode enabled, the aspect ratio constraint is removed. The crop info displays the computed bar sizes in real-time (e.g., "Pillarbox: 142px bars left & right").
5. **Process**:
   - Crop coordinates are sent to Flask backend (or processed locally in browser mode)
   - Pillow crops the image to selected area
   - **Standard mode**: Image is stretched to fill the target resolution
   - **Letterbox mode**: Image is scaled to fit within the target (maintaining its aspect ratio) and centered on a black canvas, producing equal bars on each side
   - High-quality JPEG is saved (quality=95)
6. **Download**: Processed image is served for download

## Configuration

Edit `app.py` to customize:

- **Max file size**: `app.config['MAX_CONTENT_LENGTH']` (default: 16MB)
- **Allowed formats**: `app.config['ALLOWED_EXTENSIONS']`
- **Add presets**: Modify `PRESETS` dictionary
- **Output quality**: Change `quality` parameter in `crop_and_upscale()`

## Adding Custom Resolutions

In `app.py`, add to the `PRESETS` dictionary:

```python
PRESETS = {
    '4k': {'width': 3840, 'height': 2160, 'name': '4K Ultra HD'},
    'fhd': {'width': 1920, 'height': 1080, 'name': 'Full HD'},
    'custom': {'width': 2560, 'height': 1440, 'name': 'QHD'}  # Add this
}
```

## Testing

Comprehensive test suite with unit, integration, and end-to-end tests.

### Quick Start

```bash
# Install test dependencies (if not already installed)
pip install -r requirements.txt

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test categories
pytest tests/test_unit.py      # Unit tests only
pytest tests/test_api.py       # API integration tests
pytest tests/test_e2e.py       # End-to-end tests
```

### Testing with Your Images

1. Add your test images to the `test_images/` folder
2. Run real image tests:
```bash
pytest tests/test_e2e.py::TestRealImageProcessing -v
```

### Coverage Report

```bash
pytest --cov=app --cov-report=html
# Open htmlcov/index.html in browser
```

For detailed testing documentation, see [TESTING.md](TESTING.md)

## Known Issues

### Image Preview Requires Double-Click on Subsequent Uploads

**Issue:** When uploading a second image after processing the first one, clicking a preset button (4K or Full HD) shows the preview of the first image. Clicking the same preset button a second time correctly displays the new image.

**Workaround:** Click your desired preset button twice when uploading subsequent images.

**Technical Details:**
This appears to be a timing issue with Cropper.js initialization when images are cached by the browser. The following fixes have been attempted:

1. **State Reset on Upload** - Destroying cropper instance and resetting UI state when new image is uploaded
2. **Race Condition Fix** - Setting `onload` handler before changing image `src`
3. **Cache Handling** - Checking `image.complete` property to handle cached images
4. **Handler Cleanup** - Removing old `onload` handlers before setting new ones

The issue persists despite these attempts. The root cause may be related to how Cropper.js interacts with the browser's image caching mechanism or the DOM update cycle.

**Impact:** Minor inconvenience - functionality works correctly after second click.

## Notes

- Uploaded and processed images are stored temporarily
- For production, consider adding cleanup jobs to remove old files
- JPEG output format provides good balance of quality and file size
- Lanczos resampling ensures high-quality upscaling

## License

Free to use and modify for personal projects.

