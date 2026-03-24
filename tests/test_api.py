import pytest
import json
import io
import os
import tempfile
from PIL import Image

class TestIndexRoute:
    """Test the main index page"""

    def test_index_loads(self, client):
        """Test that index page loads successfully"""
        response = client.get('/')
        assert response.status_code == 200
        assert b'Frame TV Image Processor' in response.data

    def test_index_contains_presets(self, client):
        """Test that the app page contains preset buttons"""
        response = client.get('/app')
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


class TestProcessDiptychEndpoint:
    """Test the /process-diptych endpoint"""

    def _upload_image(self, client, img_bytes, filename):
        """Helper to upload an image and return the server filename"""
        data = {'file': (img_bytes, filename, 'image/jpeg')}
        response = client.post('/upload', data=data, content_type='multipart/form-data')
        return response.get_json()

    def test_diptych_success_4k(self, client, sample_image_portrait, sample_image_portrait_2, app):
        """Test successful diptych processing at 4K"""
        upload1 = self._upload_image(client, sample_image_portrait, 'portrait1.jpg')
        upload2 = self._upload_image(client, sample_image_portrait_2, 'portrait2.jpg')

        process_data = {
            'filename1': upload1['filename'],
            'filename2': upload2['filename'],
            'original_filename1': upload1['original_filename'],
            'original_filename2': upload2['original_filename'],
            'preset': '4k',
            'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
            'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
        }
        response = client.post('/process-diptych',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True
        assert 'filename' in json_data
        assert 'download_url' in json_data
        assert 'suggested_filename' in json_data

        # Verify output dimensions
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
        with Image.open(processed_path) as img:
            assert img.size == (3840, 2160)

    def test_diptych_success_fhd(self, client, sample_image_portrait, sample_image_portrait_2, app):
        """Test successful diptych processing at FHD"""
        upload1 = self._upload_image(client, sample_image_portrait, 'portrait1.jpg')
        upload2 = self._upload_image(client, sample_image_portrait_2, 'portrait2.jpg')

        process_data = {
            'filename1': upload1['filename'],
            'filename2': upload2['filename'],
            'original_filename1': upload1['original_filename'],
            'original_filename2': upload2['original_filename'],
            'preset': 'fhd',
            'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
            'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
        }
        response = client.post('/process-diptych',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True

        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
        with Image.open(processed_path) as img:
            assert img.size == (1920, 1080)

    def test_diptych_missing_filename(self, client):
        """Test diptych with missing filenames returns 400"""
        process_data = {
            'preset': '4k',
            'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
            'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
        }
        response = client.post('/process-diptych',
                               data=json.dumps(process_data),
                               content_type='application/json')
        assert response.status_code == 400

    def test_diptych_invalid_preset(self, client, sample_image_portrait, sample_image_portrait_2):
        """Test diptych with invalid preset returns 400"""
        upload1 = self._upload_image(client, sample_image_portrait, 'portrait1.jpg')
        upload2 = self._upload_image(client, sample_image_portrait_2, 'portrait2.jpg')

        process_data = {
            'filename1': upload1['filename'],
            'filename2': upload2['filename'],
            'preset': 'invalid',
            'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
            'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
        }
        response = client.post('/process-diptych',
                               data=json.dumps(process_data),
                               content_type='application/json')
        assert response.status_code == 400

    def test_diptych_file_not_found(self, client):
        """Test diptych with non-existent files returns 404"""
        process_data = {
            'filename1': 'nonexistent1.jpg',
            'filename2': 'nonexistent2.jpg',
            'preset': '4k',
            'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
            'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
        }
        response = client.post('/process-diptych',
                               data=json.dumps(process_data),
                               content_type='application/json')
        assert response.status_code == 404

    def test_diptych_suggested_filename_format(self, client, sample_image_portrait, sample_image_portrait_2):
        """Test that suggested filename follows expected format"""
        upload1 = self._upload_image(client, sample_image_portrait, 'portrait1.jpg')
        upload2 = self._upload_image(client, sample_image_portrait_2, 'portrait2.jpg')

        process_data = {
            'filename1': upload1['filename'],
            'filename2': upload2['filename'],
            'original_filename1': 'portrait1.jpg',
            'original_filename2': 'portrait2.jpg',
            'preset': '4k',
            'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
            'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
        }
        response = client.post('/process-diptych',
                               data=json.dumps(process_data),
                               content_type='application/json')

        json_data = response.get_json()
        assert json_data['suggested_filename'] == 'portrait1_portrait2_pair_4k.jpg'

    def test_diptych_gap_percent_passed_through(self, client, sample_image_portrait, sample_image_portrait_2, app):
        """gap_percent in request flows through to the correct output gap width"""
        upload1 = self._upload_image(client, sample_image_portrait, 'portrait1.jpg')
        upload2 = self._upload_image(client, sample_image_portrait_2, 'portrait2.jpg')

        target_w, target_h = 1920, 1080
        sw1 = round(400 * target_h / 900)

        for gap_percent in [1, 5]:
            process_data = {
                'filename1': upload1['filename'],
                'filename2': upload2['filename'],
                'preset': 'fhd',
                'gap_percent': gap_percent,
                'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
                'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
            }
            response = client.post('/process-diptych',
                                   data=json.dumps(process_data),
                                   content_type='application/json')

            assert response.status_code == 200
            json_data = response.get_json()
            assert json_data['success'] == True

            expected_gap = round(target_w * gap_percent / 100)
            processed_path = os.path.join(app.config['PROCESSED_FOLDER'], json_data['filename'])
            with Image.open(processed_path) as img:
                assert img.size == (target_w, target_h)
                # Center of the gap column should be black
                gap_x = sw1 + expected_gap // 2
                pixel = img.getpixel((gap_x, target_h // 2))
                assert pixel == (0, 0, 0), \
                    f"Gap pixel should be black at gap_percent={gap_percent}, got {pixel}"

    def test_diptych_gap_percent_clamped(self, client, sample_image_portrait, sample_image_portrait_2, app):
        """gap_percent values outside 1-10 are clamped to that range"""
        upload1 = self._upload_image(client, sample_image_portrait, 'portrait1.jpg')
        upload2 = self._upload_image(client, sample_image_portrait_2, 'portrait2.jpg')

        # Value of 0 should be clamped to 1
        process_data = {
            'filename1': upload1['filename'],
            'filename2': upload2['filename'],
            'preset': 'fhd',
            'gap_percent': 0,
            'crop1': {'x': 0, 'y': 0, 'width': 400, 'height': 900},
            'crop2': {'x': 0, 'y': 0, 'width': 500, 'height': 800}
        }
        response = client.post('/process-diptych',
                               data=json.dumps(process_data),
                               content_type='application/json')

        assert response.status_code == 200
        json_data = response.get_json()
        assert json_data['success'] == True


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


class TestBulkScan:
    """Test the /bulk/scan endpoint"""

    def _make_image_file(self, folder, filename, width, height, color='red'):
        """Save a PIL image to a temp folder and return its path"""
        img = Image.new('RGB', (width, height), color=color)
        path = os.path.join(folder, filename)
        img.save(path, format='JPEG')
        return path

    def test_bulk_page_loads(self, client):
        """GET /bulk renders without error"""
        response = client.get('/bulk')
        assert response.status_code == 200
        assert b'Bulk Mode' in response.data

    def test_scan_no_body(self, client):
        """Missing body returns 400"""
        response = client.post('/bulk/scan',
                               data='{}',
                               content_type='application/json')
        assert response.status_code == 400

    def test_scan_folder_not_found(self, client):
        """Non-existent folder path returns 404"""
        payload = {'folder_path': '/does/not/exist/ever/12345'}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        assert response.status_code == 404
        assert 'error' in response.get_json()

    def test_scan_path_is_file_not_dir(self, client, tmp_path):
        """Passing a file path (not a directory) returns 400"""
        f = tmp_path / 'notadir.jpg'
        f.write_bytes(b'dummy')
        payload = {'folder_path': str(f)}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        assert response.status_code == 400
        assert 'error' in response.get_json()

    def test_scan_empty_folder(self, client, tmp_path):
        """Empty folder returns success with empty arrays"""
        payload = {'folder_path': str(tmp_path), 'aspect_threshold': 1.0}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['wide'] == []
        assert data['narrow'] == []
        assert data['total'] == 0

    def test_scan_classifies_wide_and_narrow(self, client, tmp_path, app):
        """Wide (landscape) and narrow (portrait) images are classified correctly"""
        self._make_image_file(tmp_path, 'landscape.jpg', 1600, 900, 'blue')   # ratio ~1.78 → wide
        self._make_image_file(tmp_path, 'portrait.jpg', 400, 900, 'cyan')     # ratio ~0.44 → narrow
        self._make_image_file(tmp_path, 'square.jpg', 500, 500, 'green')      # ratio 1.0 → narrow (not >1.0)

        payload = {'folder_path': str(tmp_path), 'aspect_threshold': 1.0}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['wide_count'] == 1
        assert data['narrow_count'] == 2
        assert data['total'] == 3

        wide_names = [img['original_filename'] for img in data['wide']]
        assert 'landscape.jpg' in wide_names

        narrow_names = [img['original_filename'] for img in data['narrow']]
        assert 'portrait.jpg' in narrow_names
        assert 'square.jpg' in narrow_names

    def test_scan_custom_threshold(self, client, tmp_path, app):
        """Custom aspect threshold changes classification"""
        self._make_image_file(tmp_path, 'wide43.jpg', 800, 600, 'red')    # ratio 1.33
        self._make_image_file(tmp_path, 'landscape.jpg', 1920, 1080, 'blue')  # ratio 1.78

        # Threshold 1.5 → only 16:9 (1.78) should be wide
        payload = {'folder_path': str(tmp_path), 'aspect_threshold': 1.5}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        data = response.get_json()
        assert data['wide_count'] == 1
        assert data['narrow_count'] == 1
        assert data['wide'][0]['original_filename'] == 'landscape.jpg'

    def test_scan_response_shape(self, client, tmp_path, app):
        """Each image record has required fields"""
        self._make_image_file(tmp_path, 'test.jpg', 800, 600, 'yellow')

        payload = {'folder_path': str(tmp_path), 'aspect_threshold': 1.0}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        data = response.get_json()
        record = data['wide'][0]

        assert 'upload_filename' in record
        assert 'original_filename' in record
        assert 'url' in record
        assert 'width' in record
        assert 'height' in record
        assert 'aspect_ratio' in record
        assert record['width'] == 800
        assert record['height'] == 600
        assert record['url'].startswith('/uploads/')

    def test_scan_stages_file_into_uploads(self, client, tmp_path, app):
        """Scanned files are copied into the uploads folder and are servable"""
        self._make_image_file(tmp_path, 'myimage.jpg', 400, 300, 'magenta')

        payload = {'folder_path': str(tmp_path), 'aspect_threshold': 1.0}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        data = response.get_json()
        record = data['wide'][0]

        # The staged file should be accessible via /uploads/
        serve_response = client.get(record['url'])
        assert serve_response.status_code == 200

    def test_scan_skips_non_image_files(self, client, tmp_path, app):
        """Non-image files in the folder are silently ignored"""
        self._make_image_file(tmp_path, 'real.jpg', 800, 600, 'red')
        (tmp_path / 'readme.txt').write_text('not an image')
        (tmp_path / 'data.csv').write_text('a,b,c')

        payload = {'folder_path': str(tmp_path), 'aspect_threshold': 1.0}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        data = response.get_json()
        assert data['total'] == 1  # only the JPEG counts

    def test_scan_skips_corrupt_image(self, client, tmp_path, app):
        """A corrupt file with an image extension is added to skipped, not 500"""
        self._make_image_file(tmp_path, 'good.jpg', 400, 300, 'blue')
        corrupt = tmp_path / 'corrupt.jpg'
        corrupt.write_bytes(b'this is not a real JPEG at all')

        payload = {'folder_path': str(tmp_path), 'aspect_threshold': 1.0}
        response = client.post('/bulk/scan',
                               data=json.dumps(payload),
                               content_type='application/json')
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['total'] == 1          # only the good image
        assert 'corrupt.jpg' in data['skipped']
