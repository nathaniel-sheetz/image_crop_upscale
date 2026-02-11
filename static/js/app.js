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
    letterboxEnabled: false,
    // Diptych state
    diptychMode: false,
    image2UploadedFilename: null,
    image2OriginalFilename: null,
    image2ImageUrl: null,
    cropper2: null
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

// Process image
function initializeProcess() {
    processBtn.addEventListener('click', processImage);
}

async function processImage() {
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
        // Destroy croppers before resetting state
        if (state.cropper) {
            state.cropper.destroy();
        }
        if (state.cropper2) {
            state.cropper2.destroy();
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
            letterboxEnabled: false,
            diptychMode: false,
            image2UploadedFilename: null,
            image2OriginalFilename: null,
            image2ImageUrl: null,
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

async function handleFile2(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    if (!validTypes.includes(file.type)) {
        uploadStatus2.className = 'error';
        uploadStatus2.textContent = 'Invalid file type. Please upload an image file.';
        return;
    }

    if (file.size > 16 * 1024 * 1024) {
        uploadStatus2.className = 'error';
        uploadStatus2.textContent = 'File too large. Maximum size is 16MB.';
        return;
    }

    uploadStatus2.className = 'loading';
    uploadStatus2.textContent = 'Uploading...';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            state.image2UploadedFilename = data.filename;
            state.image2OriginalFilename = data.original_filename;
            state.image2ImageUrl = data.url;

            uploadStatus2.className = 'success';
            uploadStatus2.textContent = `Uploaded successfully! (${data.width} × ${data.height})`;

            initializeCropper2();
        } else {
            uploadStatus2.className = 'error';
            uploadStatus2.textContent = data.error || 'Upload failed';
        }
    } catch (error) {
        uploadStatus2.className = 'error';
        uploadStatus2.textContent = 'Upload failed: ' + error.message;
    }
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
    state.image2UploadedFilename = null;
    state.image2OriginalFilename = null;
    state.image2ImageUrl = null;

    diptychControls.style.display = 'none';
    diptychUploadSection.style.display = 'none';
    diptychCropSection.style.display = 'none';
    diptychCropWarning.style.display = 'none';
    if (uploadStatus2) uploadStatus2.textContent = '';
    if (fileInput2) fileInput2.value = '';
    letterboxToggle.disabled = false;
}

async function processDiptychImage() {
    if (!state.cropper || !state.cropper2) {
        showProcessStatus('Please crop both images first', 'error');
        return;
    }

    const cropData1 = state.cropper.getData();
    const cropData2 = state.cropper2.getData();

    const requestData = {
        filename1: state.uploadedFilename,
        filename2: state.image2UploadedFilename,
        original_filename1: state.originalFilename,
        original_filename2: state.image2OriginalFilename,
        preset: state.selectedPreset,
        crop1: {
            x: Math.round(cropData1.x),
            y: Math.round(cropData1.y),
            width: Math.round(cropData1.width),
            height: Math.round(cropData1.height)
        },
        crop2: {
            x: Math.round(cropData2.x),
            y: Math.round(cropData2.y),
            width: Math.round(cropData2.width),
            height: Math.round(cropData2.height)
        }
    };

    processBtn.disabled = true;
    showProcessStatus('Processing diptych...', 'loading');

    try {
        const response = await fetch('/process-diptych', {
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

            const nameWithoutExt = data.suggested_filename.replace(/\.jpg$/i, '');
            downloadFilenameInput.value = nameWithoutExt;

            showProcessStatus('Processing complete!', 'success');

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
