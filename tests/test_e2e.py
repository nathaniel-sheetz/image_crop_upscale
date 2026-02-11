import pytest
import os
import json
from PIL import Image
import glob

class TestEndToEndWorkflow:
    """End-to-end tests simulating complete user workflow"""

    def test_complete_workflow_4k(self, client, sample_image, app):
        """Test complete workflow: upload -> process to 4K -> download"""
        # Step 1: Upload image
        upload_data = {
            'file': (sample_image, 'test.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload',
                                     data=upload_data,
                                     content_type='multipart/form-data')

        assert upload_response.status_code == 200
        upload_json = upload_response.get_json()
        assert upload_json['success'] == True
        filename = upload_json['filename']

        # Step 2: Process to 4K
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
        process_response = client.post('/process',
                                      data=json.dumps(process_data),
                                      content_type='application/json')

        assert process_response.status_code == 200
        process_json = process_response.get_json()
        assert process_json['success'] == True
        processed_filename = process_json['filename']

        # Step 3: Verify processed file
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)
        assert os.path.exists(processed_path)

        with Image.open(processed_path) as img:
            assert img.size == (3840, 2160)
            assert img.mode == 'RGB'

        # Step 4: Download
        download_response = client.get(f'/download/{processed_filename}')
        assert download_response.status_code == 200
        assert len(download_response.data) > 0

    def test_complete_workflow_fhd(self, client, sample_image_large, app):
        """Test complete workflow: upload -> process to Full HD -> download"""
        # Upload large image
        upload_data = {
            'file': (sample_image_large, 'large.jpg', 'image/jpeg')
        }
        upload_response = client.post('/upload',
                                     data=upload_data,
                                     content_type='multipart/form-data')

        upload_json = upload_response.get_json()
        filename = upload_json['filename']

        # Process to Full HD with crop from center
        process_data = {
            'filename': filename,
            'preset': 'fhd',
            'crop': {
                'x': 250,
                'y': 250,
                'width': 1500,
                'height': 843
            }
        }
        process_response = client.post('/process',
                                      data=json.dumps(process_data),
                                      content_type='application/json')

        process_json = process_response.get_json()
        assert process_json['success'] == True

        # Verify
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], process_json['filename'])
        with Image.open(processed_path) as img:
            assert img.size == (1920, 1080)

        # Download
        download_response = client.get(f'/download/{process_json["filename"]}')
        assert download_response.status_code == 200

    def test_multiple_images_sequentially(self, client, app):
        """Test processing multiple images in sequence"""
        results = []

        for i in range(3):
            # Create unique image
            from io import BytesIO
            img = Image.new('RGB', (1000, 750), color=('red', 'green', 'blue')[i])
            img_bytes = BytesIO()
            img.save(img_bytes, format='JPEG')
            img_bytes.seek(0)

            # Upload
            upload_response = client.post('/upload',
                                         data={'file': (img_bytes, f'test{i}.jpg', 'image/jpeg')},
                                         content_type='multipart/form-data')
            filename = upload_response.get_json()['filename']

            # Process
            process_data = {
                'filename': filename,
                'preset': 'fhd',
                'crop': {'x': 0, 'y': 0, 'width': 1000, 'height': 562}
            }
            process_response = client.post('/process',
                                          data=json.dumps(process_data),
                                          content_type='application/json')

            process_json = process_response.get_json()
            results.append(process_json['filename'])

        # Verify all processed files exist
        for processed_filename in results:
            processed_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)
            assert os.path.exists(processed_path)

            with Image.open(processed_path) as img:
                assert img.size == (1920, 1080)


class TestDiptychEndToEnd:
    """End-to-end tests for diptych workflow"""

    def test_diptych_full_workflow(self, client, sample_image_portrait, sample_image_portrait_2, app):
        """Test complete diptych workflow: upload 1 -> upload 2 -> process -> download"""
        # Step 1: Upload image 1
        upload1_response = client.post('/upload',
                                       data={'file': (sample_image_portrait, 'img1.jpg', 'image/jpeg')},
                                       content_type='multipart/form-data')
        assert upload1_response.status_code == 200
        upload1 = upload1_response.get_json()
        assert upload1['success'] == True

        # Step 2: Upload image 2
        upload2_response = client.post('/upload',
                                       data={'file': (sample_image_portrait_2, 'img2.jpg', 'image/jpeg')},
                                       content_type='multipart/form-data')
        assert upload2_response.status_code == 200
        upload2 = upload2_response.get_json()
        assert upload2['success'] == True

        # Step 3: Process diptych
        process_data = {
            'filename1': upload1['filename'],
            'filename2': upload2['filename'],
            'original_filename1': upload1['original_filename'],
            'original_filename2': upload2['original_filename'],
            'preset': '4k',
            'crop1': {'x': 0, 'y': 0, 'width': upload1['width'], 'height': upload1['height']},
            'crop2': {'x': 0, 'y': 0, 'width': upload2['width'], 'height': upload2['height']}
        }
        process_response = client.post('/process-diptych',
                                       data=json.dumps(process_data),
                                       content_type='application/json')
        assert process_response.status_code == 200
        process_json = process_response.get_json()
        assert process_json['success'] == True

        # Step 4: Verify processed file
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], process_json['filename'])
        assert os.path.exists(processed_path)
        with Image.open(processed_path) as img:
            assert img.size == (3840, 2160)
            assert img.mode == 'RGB'

        # Step 5: Download
        download_response = client.get(f'/download/{process_json["filename"]}')
        assert download_response.status_code == 200
        assert len(download_response.data) > 0


class TestRealImageProcessing:
    """Tests using real images from test_images folder"""

    @pytest.fixture
    def real_images(self):
        """Get list of real test images if they exist"""
        test_images_dir = 'test_images'
        if not os.path.exists(test_images_dir):
            return []

        patterns = ['*.jpg', '*.jpeg', '*.png', '*.webp', '*.bmp']
        images = []
        for pattern in patterns:
            images.extend(glob.glob(os.path.join(test_images_dir, pattern)))

        return images

    def test_process_real_images_4k(self, client, app, real_images):
        """Test processing real images to 4K resolution"""
        if not real_images:
            pytest.skip("No test images found in test_images/ folder")

        for image_path in real_images:
            print(f"\nProcessing: {image_path}")

            # Get image info
            with Image.open(image_path) as img:
                original_size = img.size
                print(f"Original size: {original_size}")

            # Upload
            with open(image_path, 'rb') as f:
                upload_data = {
                    'file': (f, os.path.basename(image_path))
                }
                upload_response = client.post('/upload',
                                             data=upload_data,
                                             content_type='multipart/form-data')

            assert upload_response.status_code == 200
            upload_json = upload_response.get_json()
            filename = upload_json['filename']

            # Calculate crop coordinates (use center crop with 16:9 aspect ratio)
            width, height = original_size
            target_aspect = 16 / 9

            if width / height > target_aspect:
                # Image is wider, crop width
                crop_height = height
                crop_width = int(height * target_aspect)
                crop_x = (width - crop_width) // 2
                crop_y = 0
            else:
                # Image is taller, crop height
                crop_width = width
                crop_height = int(width / target_aspect)
                crop_x = 0
                crop_y = (height - crop_height) // 2

            # Process to 4K
            process_data = {
                'filename': filename,
                'preset': '4k',
                'crop': {
                    'x': crop_x,
                    'y': crop_y,
                    'width': crop_width,
                    'height': crop_height
                }
            }
            process_response = client.post('/process',
                                          data=json.dumps(process_data),
                                          content_type='application/json')

            assert process_response.status_code == 200
            process_json = process_response.get_json()
            assert process_json['success'] == True

            # Verify processed file
            processed_path = os.path.join(app.config['PROCESSED_FOLDER'],
                                         process_json['filename'])
            assert os.path.exists(processed_path)

            with Image.open(processed_path) as img:
                assert img.size == (3840, 2160)
                print(f"Processed to: {img.size}")

    def test_process_real_images_fhd(self, client, app, real_images):
        """Test processing real images to Full HD resolution"""
        if not real_images:
            pytest.skip("No test images found in test_images/ folder")

        for image_path in real_images:
            print(f"\nProcessing: {image_path}")

            # Get original dimensions
            with Image.open(image_path) as img:
                original_size = img.size

            # Upload
            with open(image_path, 'rb') as f:
                upload_data = {
                    'file': (f, os.path.basename(image_path))
                }
                upload_response = client.post('/upload',
                                             data=upload_data,
                                             content_type='multipart/form-data')

            upload_json = upload_response.get_json()
            filename = upload_json['filename']

            # Calculate center crop for 16:9
            width, height = original_size
            target_aspect = 16 / 9

            if width / height > target_aspect:
                crop_height = height
                crop_width = int(height * target_aspect)
                crop_x = (width - crop_width) // 2
                crop_y = 0
            else:
                crop_width = width
                crop_height = int(width / target_aspect)
                crop_x = 0
                crop_y = (height - crop_height) // 2

            # Process to Full HD
            process_data = {
                'filename': filename,
                'preset': 'fhd',
                'crop': {
                    'x': crop_x,
                    'y': crop_y,
                    'width': crop_width,
                    'height': crop_height
                }
            }
            process_response = client.post('/process',
                                          data=json.dumps(process_data),
                                          content_type='application/json')

            process_json = process_response.get_json()
            assert process_json['success'] == True

            # Verify
            processed_path = os.path.join(app.config['PROCESSED_FOLDER'],
                                         process_json['filename'])
            with Image.open(processed_path) as img:
                assert img.size == (1920, 1080)

    def test_edge_cases_with_real_images(self, client, app, real_images):
        """Test edge cases: very small crops, full image crops, etc."""
        if not real_images:
            pytest.skip("No test images found in test_images/ folder")

        if len(real_images) == 0:
            pytest.skip("Need at least one test image")

        image_path = real_images[0]

        with Image.open(image_path) as img:
            width, height = img.size

        # Upload once
        with open(image_path, 'rb') as f:
            upload_data = {
                'file': (f, os.path.basename(image_path))
            }
            upload_response = client.post('/upload',
                                         data=upload_data,
                                         content_type='multipart/form-data')

        filename = upload_response.get_json()['filename']

        # Test case 1: Full image crop
        crop_width = min(width, int(height * 16/9))
        crop_height = int(crop_width * 9/16)

        process_data = {
            'filename': filename,
            'preset': 'fhd',
            'crop': {
                'x': 0,
                'y': 0,
                'width': crop_width,
                'height': crop_height
            }
        }
        response = client.post('/process',
                              data=json.dumps(process_data),
                              content_type='application/json')

        assert response.status_code == 200
        assert response.get_json()['success'] == True


class TestImageQuality:
    """Test image quality after processing"""

    def test_output_format_is_jpeg(self, client, sample_image, app):
        """Test that output files are JPEG format"""
        # Upload and process
        upload_data = {'file': (sample_image, 'test.jpg', 'image/jpeg')}
        upload_response = client.post('/upload',
                                     data=upload_data,
                                     content_type='multipart/form-data')
        filename = upload_response.get_json()['filename']

        process_data = {
            'filename': filename,
            'preset': '4k',
            'crop': {'x': 0, 'y': 0, 'width': 800, 'height': 450}
        }
        process_response = client.post('/process',
                                      data=json.dumps(process_data),
                                      content_type='application/json')

        processed_filename = process_response.get_json()['filename']
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)

        # Verify JPEG format
        with Image.open(processed_path) as img:
            assert img.format == 'JPEG'

    def test_output_file_size_reasonable(self, client, sample_image, app):
        """Test that output files aren't excessively large"""
        # Upload and process
        upload_data = {'file': (sample_image, 'test.jpg', 'image/jpeg')}
        upload_response = client.post('/upload',
                                     data=upload_data,
                                     content_type='multipart/form-data')
        filename = upload_response.get_json()['filename']

        process_data = {
            'filename': filename,
            'preset': '4k',
            'crop': {'x': 0, 'y': 0, 'width': 800, 'height': 450}
        }
        process_response = client.post('/process',
                                      data=json.dumps(process_data),
                                      content_type='application/json')

        processed_filename = process_response.get_json()['filename']
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)

        # Check file size (4K JPEG should be under 10MB for typical content)
        file_size = os.path.getsize(processed_path)
        assert file_size < 10 * 1024 * 1024  # Less than 10MB
        assert file_size > 10 * 1024  # More than 10KB (sanity check)
