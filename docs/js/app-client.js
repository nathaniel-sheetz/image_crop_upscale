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
    letterboxEnabled: false,
    // Diptych state
    diptychMode: false,
    image2File: null,
    image2Image: null,
    image2ImageUrl: null,
    image2OriginalFilename: null,
    cropper2: null
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

// Diptych DOM Elements
const diptychControls = document.getElementById('diptych-controls');
const diptychBtn = document.getElementById('diptych-btn');
const diptychUploadSection = document.getElementById('diptych-upload-section');
const uploadArea2 = document.getElementById('upload-area-2');
const fileInput2 = document.getElementById('file-input-2');
const uploadStatus2 = document.getElementById('upload-status-2');
const diptychCropSection = document.getElementById('diptych-crop-section');
const cropImage2 = document.getElementById('crop-image-2');
const cropInfo2 = document.getElementById('crop-info-2');
const diptychCropWarning = document.getElementById('diptych-crop-warning');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeUpload();
    initializePresets();
    initializeLetterbox();
    initializeProcess();
    initializeDownload();
    initializeDiptych();
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

            // Reset diptych mode if active
            if (state.diptychMode) {
                resetDiptychState();
            }

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

        // Show/hide diptych button based on whether there's room for a second image
        const sw1 = Math.round(width * targetH / height);
        const gap = Math.round(targetW * 0.01);
        if (sw1 < targetW - gap && !state.diptychMode) {
            diptychControls.style.display = 'block';
        } else if (!state.diptychMode) {
            diptychControls.style.display = 'none';
        }

        // Update cropper2 aspect ratio if in diptych mode
        if (state.diptychMode && state.cropper2) {
            const ratio2 = computeImage2Ratio();
            if (ratio2 !== null && ratio2 > 0) {
                state.cropper2.setAspectRatio(ratio2);
                diptychCropWarning.style.display = 'none';
            } else {
                diptychCropWarning.textContent = 'Image 1 crop is too wide — no room for a second image.';
                diptychCropWarning.style.display = 'block';
            }
        }
    } else {
        diptychControls.style.display = 'none';
    }

    cropInfo.textContent = info;
}

// Process image using Canvas API
function initializeProcess() {
    processBtn.addEventListener('click', processImage);
}

function processImage() {
    if (state.diptychMode) {
        processDiptychImage();
        return;
    }

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
        // Destroy croppers before resetting state
        if (state.cropper) {
            state.cropper.destroy();
        }
        if (state.cropper2) {
            state.cropper2.destroy();
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
            letterboxEnabled: false,
            diptychMode: false,
            image2File: null,
            image2Image: null,
            image2ImageUrl: null,
            image2OriginalFilename: null,
            cropper2: null
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
        letterboxToggle.disabled = false;
        letterboxHint.style.display = 'none';

        // Reset diptych UI
        diptychControls.style.display = 'none';
        diptychUploadSection.style.display = 'none';
        diptychCropSection.style.display = 'none';
        diptychCropWarning.style.display = 'none';
        if (uploadStatus2) uploadStatus2.textContent = '';
        if (fileInput2) fileInput2.value = '';

        presetButtons.forEach(btn => btn.classList.remove('active'));

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Diptych functionality
function initializeDiptych() {
    // Diptych button click
    diptychBtn.addEventListener('click', function() {
        state.diptychMode = true;
        letterboxToggle.disabled = true;
        diptychControls.style.display = 'none';
        diptychUploadSection.style.display = 'block';
        diptychUploadSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Upload area 2 click
    uploadArea2.addEventListener('click', () => fileInput2.click());

    // File input 2
    fileInput2.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFile2(e.target.files[0]);
        }
    });

    // Drag and drop for upload area 2
    uploadArea2.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea2.classList.add('dragover');
    });

    uploadArea2.addEventListener('dragleave', () => {
        uploadArea2.classList.remove('dragover');
    });

    uploadArea2.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea2.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile2(e.dataTransfer.files[0]);
        }
    });
}

function handleFile2(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
        uploadStatus2.className = 'error';
        uploadStatus2.textContent = 'Invalid file type. Please upload an image file.';
        return;
    }

    uploadStatus2.className = 'loading';
    uploadStatus2.textContent = 'Loading image...';

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            state.image2File = file;
            state.image2Image = img;
            state.image2ImageUrl = e.target.result;
            state.image2OriginalFilename = file.name;

            uploadStatus2.className = 'success';
            uploadStatus2.textContent = `Loaded successfully! (${img.width} × ${img.height})`;

            initializeCropper2();
        };
        img.onerror = function() {
            uploadStatus2.className = 'error';
            uploadStatus2.textContent = 'Failed to load image';
        };
        img.src = e.target.result;
    };
    reader.onerror = function() {
        uploadStatus2.className = 'error';
        uploadStatus2.textContent = 'Failed to read file';
    };
    reader.readAsDataURL(file);
}

function computeImage2Ratio() {
    if (!state.cropper || !state.selectedPresetData) return null;

    const cropData = state.cropper.getData();
    const cropW = Math.round(cropData.width);
    const cropH = Math.round(cropData.height);

    if (cropW <= 0 || cropH <= 0) return null;

    const targetW = state.selectedPresetData.width;
    const targetH = state.selectedPresetData.height;
    const gap = Math.round(targetW * 0.01);
    const sw1 = Math.round(cropW * targetH / cropH);
    const sw2 = targetW - gap - sw1;

    if (sw2 <= 0) return null;

    return sw2 / targetH;
}

function initializeCropper2() {
    if (state.cropper2) {
        state.cropper2.destroy();
    }

    diptychCropSection.style.display = 'block';

    const ratio2 = computeImage2Ratio();
    const aspectRatio = (ratio2 !== null && ratio2 > 0) ? ratio2 : 1;

    function createCropper2() {
        if (state.cropper2) {
            state.cropper2.destroy();
        }
        state.cropper2 = new Cropper(cropImage2, {
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
                updateCropInfo2(event.detail);
            }
        });
    }

    cropImage2.onload = null;
    cropImage2.onload = function() {
        createCropper2();
    };

    cropImage2.src = state.image2ImageUrl;

    if (cropImage2.complete && cropImage2.naturalWidth > 0) {
        createCropper2();
    }

    diptychCropSection.scrollIntoView({ behavior: 'smooth' });
}

function updateCropInfo2(detail) {
    const width = Math.round(detail.width);
    const height = Math.round(detail.height);
    const x = Math.round(detail.x);
    const y = Math.round(detail.y);
    cropInfo2.textContent = `Crop area: ${width} × ${height}px at position (${x}, ${y})`;
}

function resetDiptychState() {
    if (state.cropper2) {
        state.cropper2.destroy();
        state.cropper2 = null;
    }
    state.diptychMode = false;
    state.image2File = null;
    state.image2Image = null;
    state.image2ImageUrl = null;
    state.image2OriginalFilename = null;

    diptychControls.style.display = 'none';
    diptychUploadSection.style.display = 'none';
    diptychCropSection.style.display = 'none';
    diptychCropWarning.style.display = 'none';
    if (uploadStatus2) uploadStatus2.textContent = '';
    if (fileInput2) fileInput2.value = '';
    letterboxToggle.disabled = false;
}

function processDiptychImage() {
    if (!state.cropper || !state.cropper2) {
        showProcessStatus('Please crop both images first', 'error');
        return;
    }

    const cropData1 = state.cropper.getData();
    const cropData2 = state.cropper2.getData();

    processBtn.disabled = true;
    showProcessStatus('Processing diptych...', 'loading');

    setTimeout(() => {
        try {
            const targetW = state.selectedPresetData.width;
            const targetH = state.selectedPresetData.height;

            const crop1W = Math.round(cropData1.width);
            const crop1H = Math.round(cropData1.height);
            const gap = Math.round(targetW * 0.01);
            const sw1 = Math.round(crop1W * targetH / crop1H);
            const sw2 = targetW - gap - sw1;

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Fill with black (for the gap)
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, targetW, targetH);

            // Draw image 1
            ctx.drawImage(
                state.uploadedImage,
                Math.round(cropData1.x), Math.round(cropData1.y),
                crop1W, crop1H,
                0, 0, sw1, targetH
            );

            // Draw image 2
            ctx.drawImage(
                state.image2Image,
                Math.round(cropData2.x), Math.round(cropData2.y),
                Math.round(cropData2.width), Math.round(cropData2.height),
                sw1 + gap, 0, sw2, targetH
            );

            canvas.toBlob(function(blob) {
                if (blob) {
                    state.processedImageBlob = blob;

                    const name1 = state.originalFilename.replace(/\.[^/.]+$/, '');
                    const name2 = state.image2OriginalFilename.replace(/\.[^/.]+$/, '');
                    const presetSuffix = state.selectedPreset === '4k' ? '_4k' : '_fhd';
                    state.suggestedFilename = `${name1}_${name2}_pair${presetSuffix}`;

                    downloadFilenameInput.value = state.suggestedFilename;

                    showProcessStatus('Processing complete!', 'success');

                    setTimeout(() => {
                        downloadSection.style.display = 'block';
                        downloadSection.scrollIntoView({ behavior: 'smooth' });
                    }, 500);
                } else {
                    showProcessStatus('Failed to process diptych', 'error');
                    processBtn.disabled = false;
                }
            }, 'image/jpeg', 0.95);

        } catch (error) {
            showProcessStatus('Processing failed: ' + error.message, 'error');
            processBtn.disabled = false;
        }
    }, 100);
}
