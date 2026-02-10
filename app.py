import os
from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image
from werkzeug.utils import secure_filename
import uuid
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}

# Ensure directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

# Preset resolutions
PRESETS = {
    '4k': {'width': 3840, 'height': 2160, 'name': '4K Ultra HD'},
    'fhd': {'width': 1920, 'height': 1080, 'name': 'Full HD'}
}

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def crop_and_upscale(input_path, output_path, crop_coords, target_width, target_height, letterbox=False):
    """
    Crop and upscale image to target resolution

    Args:
        input_path: Path to input image
        output_path: Path to save processed image
        crop_coords: Dict with x, y, width, height (in pixels)
        target_width: Target output width
        target_height: Target output height
        letterbox: If True, fit image within target maintaining aspect ratio
                   and fill remaining space with black bars
    """
    with Image.open(input_path) as img:
        # Crop the image
        left = int(crop_coords['x'])
        top = int(crop_coords['y'])
        right = int(crop_coords['x'] + crop_coords['width'])
        bottom = int(crop_coords['y'] + crop_coords['height'])

        cropped = img.crop((left, top, right, bottom))

        if letterbox:
            # Scale to fit within target while maintaining aspect ratio
            crop_w, crop_h = cropped.size
            scale = min(target_width / crop_w, target_height / crop_h)
            new_w = int(crop_w * scale)
            new_h = int(crop_h * scale)
            resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)

            # Center on a black canvas
            canvas = Image.new('RGB', (target_width, target_height), (0, 0, 0))
            paste_x = (target_width - new_w) // 2
            paste_y = (target_height - new_h) // 2
            canvas.paste(resized, (paste_x, paste_y))

            canvas.save(output_path, quality=95, optimize=True)
        else:
            # Resize to target resolution using high-quality Lanczos resampling
            resized = cropped.resize((target_width, target_height), Image.Resampling.LANCZOS)

            # Save with high quality
            resized.save(output_path, quality=95, optimize=True)

    return output_path

@app.route('/')
def mode_selector():
    """Landing page to choose processing mode"""
    return render_template('mode_selector.html')

@app.route('/app')
def server_app():
    """Original Flask version with server processing"""
    return render_template('index.html', presets=PRESETS)

@app.route('/client')
def client_app():
    """Serve client-side only version"""
    return send_file('client-side/index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    # Generate unique filename
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{filename}"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)

    file.save(filepath)

    # Get image dimensions
    with Image.open(filepath) as img:
        width, height = img.size

    return jsonify({
        'success': True,
        'filename': unique_filename,
        'original_filename': filename,
        'width': width,
        'height': height,
        'url': f'/uploads/{unique_filename}'
    })

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename))

@app.route('/process', methods=['POST'])
def process_image():
    """Process image with crop and upscale"""
    data = request.json

    if not data or 'filename' not in data:
        return jsonify({'error': 'No filename provided'}), 400

    filename = data['filename']
    original_filename = data.get('original_filename', 'image.jpg')
    preset = data.get('preset', '4k')
    crop_coords = data.get('crop', {})
    letterbox = data.get('letterbox', False)

    if preset not in PRESETS:
        return jsonify({'error': 'Invalid preset'}), 400

    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

    if not os.path.exists(input_path):
        return jsonify({'error': 'File not found'}), 404

    # Generate output filename based on original name and preset
    name_without_ext = os.path.splitext(original_filename)[0]
    preset_suffix = '_4k' if preset == '4k' else '_fhd'
    suggested_filename = f"{name_without_ext}{preset_suffix}.jpg"

    # Use UUID for internal storage to avoid conflicts
    output_filename = f"processed_{uuid.uuid4()}.jpg"
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], output_filename)

    try:
        # Process the image
        target_res = PRESETS[preset]
        crop_and_upscale(
            input_path,
            output_path,
            crop_coords,
            target_res['width'],
            target_res['height'],
            letterbox=letterbox
        )

        return jsonify({
            'success': True,
            'filename': output_filename,
            'suggested_filename': suggested_filename,
            'download_url': f'/download/{output_filename}'
        })

    except Exception as e:
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500

@app.route('/download/<filename>')
def download_file(filename):
    """Download processed file"""
    filepath = os.path.join(app.config['PROCESSED_FOLDER'], filename)

    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404

    # Get custom download name from query parameter, or use default
    custom_name = request.args.get('name', None)

    if custom_name:
        # Sanitize the custom filename
        custom_name = secure_filename(custom_name)
        # Ensure it ends with .jpg
        if not custom_name.lower().endswith('.jpg'):
            custom_name = f"{custom_name}.jpg"
        download_name = custom_name
    else:
        download_name = f'frame_tv_{filename}'

    return send_file(filepath, as_attachment=True, download_name=download_name)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
