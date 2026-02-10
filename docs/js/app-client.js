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
    suggestedFilename: null,
    letterboxEnabled: false
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

            if (state.letterboxEnabled) {
                // Fill with black background
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Scale to fit within target maintaining aspect ratio
                const cropW = Math.round(cropData.width);
                const cropH = Math.round(cropData.height);
                const scale = Math.min(canvas.width / cropW, canvas.height / cropH);
                const drawW = Math.round(cropW * scale);
                const drawH = Math.round(cropH * scale);
                const drawX = Math.round((canvas.width - drawW) / 2);
                const drawY = Math.round((canvas.height - drawH) / 2);

                ctx.drawImage(
                    state.uploadedImage,
                    Math.round(cropData.x),
                    Math.round(cropData.y),
                    cropW,
                    cropH,
                    drawX,
                    drawY,
                    drawW,
                    drawH
                );
            } else {
                // Draw the cropped and resized image (stretch to fill)
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
            }

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
        // Destroy cropper before resetting state
        if (state.cropper) {
            state.cropper.destroy();
        }

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
