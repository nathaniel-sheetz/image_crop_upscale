import pytest
import json
import io
import os
from PIL import Image

class TestIndexRoute:
    """Test the main index page"""

    def test_index_loads(self, client):
        """Test that index page loads successfully"""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Frame TV Image Processor' in response.data

    def test_index_contains_presets(self, client):
        """Test that index page contains preset buttons"""
        response = client.get('/')
        assert b'4K' in response.data or b'4k' in response.data
        assert b'Full HD' in response.data or b'1920' in response.data


class TestUploadEndpoint:
    """Test the /upload endpoint"""

    def test_upload_success(self, client, sample_image):
        """Test successful image upload"""
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        response = client.post('/upload', data=data, content_type='multipart/form-data')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True
        assert 'filename' in json_data
        assert 'width' in json_data
        assert 'height' in json_data
        assert json_data['width'] == 800
        assert json_data['height'] == 600

    def test_upload_no_file(self, client):
        """Test upload with no file provided"""
        response = client.post('/upload', data={}, content_type='multipart/form-data')

        assert response.status_code == 400
        json_data = response.get_json()
        assert 'error' in json_data

    def test_upload_empty_filename(self, client):
        """Test upload with empty filename"""
        data = {
            'file': (io.BytesIO(b''), '', 'image/jpeg')
        }
        response = client.post('/upload', data=data, content_type='multipart/form-data')

        assert response.status_code == 400
        json_data = response.get_json()
        assert 'error' in json_data

    def test_upload_invalid_type(self, client):
        """Test upload with invalid file type"""
        data = {
            'file': (io.BytesIO(b'test content'), 'test.txt', 'text/plain')
        }
        response = client.post('/upload', data=data, content_type='multipart/form-data')

        assert response.status_code == 400
        json_data = response.get_json()
        assert 'error' in json_data

    def test_upload_png(self, client):
        """Test upload with PNG file"""
        img = Image.new('RGB', (640, 480), color='green')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        data = {
            'file': (img_bytes, 'test.png', 'image/png')
        }
        response = client.post('/upload', data=data, content_type='multipart/form-data')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True

    def test_upload_large_image(self, client, sample_image_large):
        """Test upload with larger image"""
        data = {
            'file': (sample_image_large, 'large.jpg', 'image/jpeg')
        }
        response = client.post('/upload', data=data, content_type='multipart/form-data')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True
        assert json_data['width'] == 2000
        assert json_data['height'] == 1500


class TestProcessEndpoint:
    """Test the /process endpoint"""

    def test_process_success_4k(self, client, sample_image, app):
        """Test successful image processing to 4K"""
        # First upload an image
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()
        filename = upload_data['filename']

        # Then process it
        process_data = {
            'filename': filename,
            'preset': '4k',
            'crop': {
                'x': 0,
                'y': 0,
                'width': 800,
                'height': 450
            }
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True
        assert 'filename' in json_data
        assert 'download_url' in json_data

        # Verify the processed file exists and has correct dimensions
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
        assert os.path.exists(processed_path)

        with Image.open(processed_path) as img:
            assert img.size == (3840, 2160)

    def test_process_success_fhd(self, client, sample_image, app):
        """Test successful image processing to Full HD"""
        # Upload
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()
        filename = upload_data['filename']

        # Process
        process_data = {
            'filename': filename,
            'preset': 'fhd',
            'crop': {
                'x': 100,
                'y': 50,
                'width': 600,
                'height': 337
            }
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True

        # Verify the processed file
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
        assert os.path.exists(processed_path)

        with Image.open(processed_path) as img:
            assert img.size == (1920, 1080)

    def test_process_no_filename(self, client):
        """Test process without filename"""
        process_data = {
            'preset': '4k',
            'crop': {'x': 0, 'y': 0, 'width': 800, 'height': 450}
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 400
        json_data = response.get_json()
        assert 'error' in json_data

    def test_process_invalid_preset(self, client, sample_image):
        """Test process with invalid preset"""
        # Upload
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()
        filename = upload_data['filename']

        # Process with invalid preset
        process_data = {
            'filename': filename,
            'preset': 'invalid_preset',
            'crop': {'x': 0, 'y': 0, 'width': 800, 'height': 450}
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 400
        json_data = response.get_json()
        assert 'error' in json_data

    def test_process_file_not_found(self, client):
        """Test process with non-existent file"""
        process_data = {
            'filename': 'nonexistent_file.jpg',
            'preset': '4k',
            'crop': {'x': 0, 'y': 0, 'width': 800, 'height': 450}
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 404
        json_data = response.get_json()
        assert 'error' in json_data

    def test_process_with_upscaling(self, client, sample_image_small, app):
        """Test processing that requires upscaling"""
        # Upload small image
        data = {
            'file': (sample_image_small, 'small.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()
        filename = upload_data['filename']

        # Process to 4K (will require significant upscaling)
        process_data = {
            'filename': filename,
            'preset': '4k',
            'crop': {
                'x': 0,
                'y': 0,
                'width': 400,
                'height': 225
            }
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True

        # Verify upscaled correctly
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
        with Image.open(processed_path) as img:
            assert img.size == (3840, 2160)


class TestProcessLetterbox:
    """Test the /process endpoint with letterbox flag"""

    def test_process_with_letterbox(self, client, sample_image, app):
        """Test processing with letterbox=true produces correct output dimensions"""
        # Upload image
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()
        filename = upload_data['filename']

        # Process with letterbox enabled and a non-16:9 crop
        process_data = {
            'filename': filename,
            'preset': '4k',
            'crop': {
                'x': 0,
                'y': 0,
                'width': 600,
                'height': 600
            },
            'letterbox': True
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True

        # Verify the processed file has correct dimensions
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
        with Image.open(processed_path) as img:
            assert img.size == (3840, 2160)
            # Square crop letterboxed to 16:9 should have black bars on sides
            assert img.getpixel((0, 0)) == (0, 0, 0)

    def test_process_without_letterbox_default(self, client, sample_image, app):
        """Test that omitting letterbox flag preserves stretch behavior"""
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()
        filename = upload_data['filename']

        process_data = {
            'filename': filename,
            'preset': 'fhd',
            'crop': {
                'x': 0,
                'y': 0,
                'width': 600,
                'height': 600
            }
        }
        response = client.post('/process',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True

        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
        with Image.open(processed_path) as img:
            assert img.size == (1920, 1080)
            # Without letterbox, corners should have image content (stretched)
            pixel = img.getpixel((0, 0))
            assert pixel != (0, 0, 0)


class TestDownloadEndpoint:
    """Test the /download endpoint"""

    def test_download_success(self, client, sample_image, app):
        """Test successful file download"""
        # Upload and process
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()

        process_data = {
            'filename': upload_data['filename'],
            'preset': '4k',
            'crop': {'x': 0, 'y': 0, 'width': 800, 'height': 450}
        }
        process_response = client.post('/process',
                                       data=json.dumps(process_data),
                                       content_type='application/json')
        process_json = process_response.get_json()

        # Download
        response = client.get(f"/download/{process_json['filename']}")

        assert response.status_code == 200
        assert response.headers['Content-Disposition'].startswith('attachment')
        assert len(response.data) > 0

    def test_download_not_found(self, client):
        """Test download with non-existent file"""
        response = client.get('/download/nonexistent.jpg')

        assert response.status_code == 404
        json_data = response.get_json()
        assert 'error' in json_data


class TestUploadedFileEndpoint:
    """Test the /uploads/<filename> endpoint"""

    def test_serve_uploaded_file(self, client, sample_image):
        """Test serving uploaded file"""
        # Upload
        data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload', data=data, content_type='multipart/form-data')
        upload_data = upload_response.get_json()
        filename = upload_data['filename']

        # Retrieve
        response = client.get(f'/uploads/{filename}')

        assert response.status_code == 200
        assert len(response.data) > 0
