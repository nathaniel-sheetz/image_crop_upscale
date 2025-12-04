// Frame TV Image Processor - Client-Side v1.0
// Pure browser processing with Canvas API

// State management
let state = {
    uploadedFile: null,
    originalFilename: null,
    uploadedImage: null,
    uploadedImageUrl: null,
    selectedPreset: null,
    selectedPresetData: null,
    cropper: null,
    processedImageBlob: null,
    suggestedFilename: null
};

// Presets configuration
const PRESETS = {
    '4k': { width: 3840, height: 2160, name: '4K Ultra HD' },
    'fhd': { width: 1920, height: 1080, name: 'Full HD' }
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

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeUpload();
    initializePresets();
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

function handleFile(file) {
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
        showUploadStatus('Invalid file type. Please upload an image file.', 'error');
        return;
    }

    showUploadStatus('Loading image...', 'loading');

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

    // Load image using FileReader
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Update state
            state.uploadedFile = file;
            state.originalFilename = file.name;
            state.uploadedImage = img;
            state.uploadedImageUrl = e.target.result;

            showUploadStatus(`Loaded successfully! (${img.width} × ${img.height})`, 'success');

            // Show preset selection
            presetSection.style.display = 'block';
        };

        img.onerror = function() {
            showUploadStatus('Failed to load image', 'error');
        };

        img.src = e.target.result;
    };

    reader.onerror = function() {
        showUploadStatus('Failed to read file', 'error');
    };

    reader.readAsDataURL(file);
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

function initializeCropper() {
    // Destroy existing cropper if any
    if (state.cropper) {
        state.cropper.destroy();
    }

    // Show crop section
    cropSection.style.display = 'block';
    processSection.style.display = 'block';

    // Calculate aspect ratio
    const aspectRatio = state.selectedPresetData.width / state.selectedPresetData.height;

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
    if (cropImage.complete && cropImage.naturalWidth > 0) {
        createCropper();
    }
}

function updateCropInfo(detail) {
    const width = Math.round(detail.width);
    const height = Math.round(detail.height);
    const x = Math.round(detail.x);
    const y = Math.round(detail.y);

    cropInfo.textContent = `Crop area: ${width} × ${height}px at position (${x}, ${y})`;
}

// Process image using Canvas API
function initializeProcess() {
    processBtn.addEventListener('click', processImage);
}

function processImage() {
    if (!state.cropper) {
        showProcessStatus('Please select a crop area first', 'error');
        return;
    }

    // Get crop data
    const cropData = state.cropper.getData();

    processBtn.disabled = true;
    showProcessStatus('Processing image...', 'loading');

    // Use setTimeout to allow UI to update
    setTimeout(() => {
        try {
            // Create canvas for processing
            const canvas = document.createElement('canvas');
            canvas.width = state.selectedPresetData.width;
            canvas.height = state.selectedPresetData.height;
            const ctx = canvas.getContext('2d');

            // Enable high-quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Draw the cropped and resized image
            ctx.drawImage(
                state.uploadedImage,
                Math.round(cropData.x),
                Math.round(cropData.y),
                Math.round(cropData.width),
                Math.round(cropData.height),
                0,
                0,
                state.selectedPresetData.width,
                state.selectedPresetData.height
            );

            // Convert canvas to blob
            canvas.toBlob(function(blob) {
                if (blob) {
                    state.processedImageBlob = blob;

                    // Generate suggested filename
                    const nameWithoutExt = state.originalFilename.replace(/\.[^/.]+$/, '');
                    const presetSuffix = state.selectedPreset === '4k' ? '_4k' : '_fhd';
                    state.suggestedFilename = `${nameWithoutExt}${presetSuffix}`;

                    // Populate filename input
                    downloadFilenameInput.value = state.suggestedFilename;

                    showProcessStatus('Processing complete!', 'success');

                    // Show download section
                    setTimeout(() => {
                        downloadSection.style.display = 'block';
                        downloadSection.scrollIntoView({ behavior: 'smooth' });
                    }, 500);
                } else {
                    showProcessStatus('Failed to process image', 'error');
                    processBtn.disabled = false;
                }
            }, 'image/jpeg', 0.95);

        } catch (error) {
            showProcessStatus('Processing failed: ' + error.message, 'error');
            processBtn.disabled = false;
        }
    }, 100);
}

function showProcessStatus(message, type) {
    processStatus.className = type;
    processStatus.textContent = message;
}

// Download functionality
function initializeDownload() {
    downloadBtn.addEventListener('click', function() {
        if (!state.processedImageBlob) {
            return;
        }

        // Get custom filename from input
        let filename = downloadFilenameInput.value.trim();

        if (!filename) {
            filename = state.suggestedFilename || 'frame_tv_image';
        }

        // Ensure .jpg extension
        if (!filename.toLowerCase().endsWith('.jpg')) {
            filename += '.jpg';
        }

        // Create download link
        const url = URL.createObjectURL(state.processedImageBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Clean up URL
        setTimeout(() => URL.revokeObjectURL(url), 100);
    });

    resetBtn.addEventListener('click', function() {
        // Reset state
        state = {
            uploadedFile: null,
            originalFilename: null,
            uploadedImage: null,
            uploadedImageUrl: null,
            selectedPreset: null,
            selectedPresetData: null,
            cropper: null,
            processedImageBlob: null,
            suggestedFilename: null
        };

        // Destroy cropper
        if (state.cropper) {
            state.cropper.destroy();
        }

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

        presetButtons.forEach(btn => btn.classList.remove('active'));

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
