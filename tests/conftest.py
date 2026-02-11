import pytest
import os
import sys
from PIL import Image
import io

# Add parent directory to path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app

@pytest.fixture
def app():
    """Create and configure a test Flask app instance"""
    flask_app.config.update({
        'TESTING': True,
        'UPLOAD_FOLDER': 'tests/test_uploads',
        'PROCESSED_FOLDER': 'tests/test_processed'
    })

    # Create test directories
    os.makedirs(flask_app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(flask_app.config['PROCESSED_FOLDER'], exist_ok=True)

    yield flask_app

    # Cleanup test directories
    cleanup_directory(flask_app.config['UPLOAD_FOLDER'])
    cleanup_directory(flask_app.config['PROCESSED_FOLDER'])

@pytest.fixture
def client(app):
    """Create a test client for the Flask app"""
    return app.test_client()

@pytest.fixture
def runner(app):
    """Create a test CLI runner"""
    return app.test_cli_runner()

@pytest.fixture
def sample_image():
    """Generate a sample test image (RGB, 800x600)"""
    img = Image.new('RGB', (800, 600), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

@pytest.fixture
def sample_image_large():
    """Generate a larger test image for upscaling (RGB, 2000x1500)"""
    img = Image.new('RGB', (2000, 1500), color='blue')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

@pytest.fixture
def sample_image_small():
    """Generate a small test image (RGB, 400x300)"""
    img = Image.new('RGB', (400, 300), color='green')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

@pytest.fixture
def sample_image_portrait():
    """Generate a portrait test image (RGB, 400x900)"""
    img = Image.new('RGB', (400, 900), color='cyan')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

@pytest.fixture
def sample_image_portrait_2():
    """Generate a second portrait test image (RGB, 500x800)"""
    img = Image.new('RGB', (500, 800), color='magenta')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)
    return img_bytes

def cleanup_directory(directory):
    """Remove all files in a directory"""
    if os.path.exists(directory):
        for filename in os.listdir(directory):
            file_path = os.path.join(directory, filename)
            if os.path.isfile(file_path):
                os.unlink(file_path)
