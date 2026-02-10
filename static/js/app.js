// Frame TV Image Processor - v2.2
// Fixed: Image preview caching issue for multiple uploads
// Added: Custom filename editing with original name preservation

// State management
let state = {
    uploadedFilename: null,
    originalFilename: null,
    uploadedImageUrl: null,
    selectedPreset: null,
    selectedPresetData: null,
    cropper: null,
    processedFilename: null,
    suggestedFilename: null,
    letterboxEnabled: false
};

// DOM Elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const uploadStatus = document.getElementById('upload-status');
const presetSection = document.getElementById('preset-section');
const presetButtons = document.querySelectorAll('.preset-btn');
const selectedPresetInfo = document.getElementById('selected-preset-info');
const selectedPresetName = document.getElementById('selected-preset-name');
const selectedPresetRes = document.getElementById('selected-preset-res');
const cropSection = document.getElementById('crop-section');
const cropImage = document.getElementById('crop-image');
const cropInfo = document.getElementById('crop-info');
const processSection = document.getElementById('process-section');
const processBtn = document.getElementById('process-btn');
const processStatus = document.getElementById('process-status');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const downloadFilenameInput = document.getElementById('download-filename');
const resetBtn = document.getElementById('reset-btn');
const letterboxToggle = document.getElementById('letterbox-toggle');
const letterboxHint = document.getElementById('letterbox-hint');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeUpload();
    initializePresets();
    initializeLetterbox();
    initializeProcess();
    initializeDownload();
});

// Upload functionality
function initializeUpload() {
    // Click to upload
    uploadArea.addEventListener('click', () => fileInput.click());

    // File selection
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

async function handleFile(file) {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
        showUploadStatus('Invalid file type. Please upload an image file.', 'error');
        return;
    }

    // Validate file size (16MB)
    if (file.size > 16 * 1024 * 1024) {
        showUploadStatus('File too large. Maximum size is 16MB.', 'error');
        return;
    }

    showUploadStatus('Uploading...', 'loading');

    // Upload file
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // Reset any existing state from previous image
            if (state.cropper) {
                state.cropper.destroy();
                state.cropper = null;
            }

            // Clear preset selections
            presetButtons.forEach(btn => btn.classList.remove('active'));
            state.selectedPreset = null;
            state.selectedPresetData = null;

            // Hide sections from previous workflow
            cropSection.style.display = 'none';
            processSection.style.display = 'none';
            downloadSection.style.display = 'none';
            selectedPresetInfo.style.display = 'none';

            // Reset button states
            processBtn.disabled = false;
            processStatus.textContent = '';

            // Update state with new image
            state.uploadedFilename = data.filename;
            state.originalFilename = data.original_filename;
            state.uploadedImageUrl = data.url;

            showUploadStatus(`Uploaded successfully! (${data.width} × ${data.height})`, 'success');

            // Show preset selection
            presetSection.style.display = 'block';
        } else {
            showUploadStatus(data.error || 'Upload failed', 'error');
        }
    } catch (error) {
        showUploadStatus('Upload failed: ' + error.message, 'error');
    }
}

function showUploadStatus(message, type) {
    uploadStatus.className = type;
    uploadStatus.textContent = message;
}

// Preset selection
function initializePresets() {
    presetButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            presetButtons.forEach(b => b.classList.remove('active'));

            // Add active class to clicked button
            this.classList.add('active');

            // Store preset data
            state.selectedPreset = this.dataset.preset;
            state.selectedPresetData = {
                width: parseInt(this.dataset.width),
                height: parseInt(this.dataset.height),
                name: this.querySelector('.preset-name').textContent,
                resolution: this.querySelector('.preset-resolution').textContent
            };

            // Update info
            selectedPresetName.textContent = state.selectedPresetData.name;
            selectedPresetRes.textContent = state.selectedPresetData.resolution;
            selectedPresetInfo.style.display = 'block';

            // Initialize cropper
            initializeCropper();
        });
    });
}

function initializeLetterbox() {
    letterboxToggle.addEventListener('change', function() {
        state.letterboxEnabled = this.checked;
        letterboxHint.style.display = this.checked ? 'block' : 'none';

        if (state.cropper) {
            if (this.checked) {
                state.cropper.setAspectRatio(NaN);
            } else {
                state.cropper.setAspectRatio(state.selectedPresetData.width / state.selectedPresetData.height);
            }
        }
    });
}

function initializeCropper() {
    // Destroy existing cropper if any
    if (state.cropper) {
        state.cropper.destroy();
    }

    // Show crop section
    cropSection.style.display = 'block';
    processSection.style.display = 'block';

    // Calculate aspect ratio (free if letterbox enabled)
    const aspectRatio = state.letterboxEnabled ? NaN : (state.selectedPresetData.width / state.selectedPresetData.height);

    // Function to initialize the cropper
    function createCropper() {
        if (state.cropper) {
            state.cropper.destroy();
        }
        state.cropper = new Cropper(cropImage, {
            aspectRatio: aspectRatio,
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            crop: function(event) {
                updateCropInfo(event.detail);
            }
        });
    }

    // Remove old onload handler to prevent duplicate initializations
    cropImage.onload = null;

    // Set new onload handler
    cropImage.onload = function() {
        createCropper();
    };

    // Force image reload by changing src
    cropImage.src = state.uploadedImageUrl;

    // Handle case where image is already cached/loaded
    // If image loads synchronously from cache, onload might not fire
    if (cropImage.complete && cropImage.naturalWidth > 0) {
        createCropper();
    }
}

function updateCropInfo(detail) {
    const width = Math.round(detail.width);
    const height = Math.round(detail.height);
    const x = Math.round(detail.x);
    const y = Math.round(detail.y);

    let info = `Crop area: ${width} × ${height}px at position (${x}, ${y})`;

    if (state.letterboxEnabled && state.selectedPresetData && width > 0 && height > 0) {
        const targetW = state.selectedPresetData.width;
        const targetH = state.selectedPresetData.height;
        const scale = Math.min(targetW / width, targetH / height);
        const scaledW = Math.round(width * scale);
        const scaledH = Math.round(height * scale);
        const barX = Math.round((targetW - scaledW) / 2);
        const barY = Math.round((targetH - scaledH) / 2);

        if (barX > 0) {
            info += ` | Pillarbox: ${barX}px bars left & right`;
        } else if (barY > 0) {
            info += ` | Letterbox: ${barY}px bars top & bottom`;
        } else {
            info += ` | No bars (fits frame exactly)`;
        }
    }

    cropInfo.textContent = info;
}

// Process image
function initializeProcess() {
    processBtn.addEventListener('click', processImage);
}

async function processImage() {
    if (!state.cropper) {
        showProcessStatus('Please select a crop area first', 'error');
        return;
    }

    // Get crop data
    const cropData = state.cropper.getData();

    const requestData = {
        filename: state.uploadedFilename,
        original_filename: state.originalFilename,
        preset: state.selectedPreset,
        crop: {
            x: Math.round(cropData.x),
            y: Math.round(cropData.y),
            width: Math.round(cropData.width),
            height: Math.round(cropData.height)
        },
        letterbox: state.letterboxEnabled
    };

    processBtn.disabled = true;
    showProcessStatus('Processing image...', 'loading');

    try {
        const response = await fetch('/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.success) {
            state.processedFilename = data.filename;
            state.suggestedFilename = data.suggested_filename;
            state.downloadUrl = data.download_url;

            // Populate filename input (remove .jpg extension)
            const nameWithoutExt = data.suggested_filename.replace(/\.jpg$/i, '');
            downloadFilenameInput.value = nameWithoutExt;

            showProcessStatus('Processing complete!', 'success');

            // Show download section
            setTimeout(() => {
                downloadSection.style.display = 'block';
                downloadSection.scrollIntoView({ behavior: 'smooth' });
            }, 500);
        } else {
            showProcessStatus(data.error || 'Processing failed', 'error');
            processBtn.disabled = false;
        }
    } catch (error) {
        showProcessStatus('Processing failed: ' + error.message, 'error');
        processBtn.disabled = false;
    }
}

function showProcessStatus(message, type) {
    processStatus.className = type;
    processStatus.textContent = message;
}

// Download functionality
function initializeDownload() {
    downloadBtn.addEventListener('click', function() {
        // Get custom filename from input
        const customName = downloadFilenameInput.value.trim();

        if (customName) {
            // Add custom name as query parameter
            const url = new URL(state.downloadUrl, window.location.origin);
            url.searchParams.set('name', customName);
            window.location.href = url.toString();
        } else {
            window.location.href = state.downloadUrl;
        }
    });

    resetBtn.addEventListener('click', function() {
        // Destroy cropper before resetting state
        if (state.cropper) {
            state.cropper.destroy();
        }

        // Reset state
        state = {
            uploadedFilename: null,
            originalFilename: null,
            uploadedImageUrl: null,
            selectedPreset: null,
            selectedPresetData: null,
            cropper: null,
            processedFilename: null,
            suggestedFilename: null,
            letterboxEnabled: false
        };

        // Reset UI
        fileInput.value = '';
        uploadStatus.textContent = '';
        presetSection.style.display = 'none';
        cropSection.style.display = 'none';
        processSection.style.display = 'none';
        downloadSection.style.display = 'none';
        processBtn.disabled = false;
        processStatus.textContent = '';
        selectedPresetInfo.style.display = 'none';
        letterboxToggle.checked = false;
        letterboxHint.style.display = 'none';

        presetButtons.forEach(btn => btn.classList.remove('active'));

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
