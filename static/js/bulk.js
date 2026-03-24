'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const bulkState = {
    // Setup
    folderPath: '',
    aspectThreshold: 1.0,
    preset: null,       // e.g. '4k'
    presetData: null,   // { width, height, name }

    // Scan results
    wideImages: [],
    narrowImages: [],

    // Wide phase
    wideIndex: 0,
    wideCropper: null,
    wideLetterbox: false,
    wideCrop1Changed: false,

    // Narrow phase
    selectedNarrowIndices: [],
    narrowCropper1: null,
    narrowCropper2: null,
    narrowGapPercent: 1,
    narrowCrop1Data: null,

    // Gallery process-again
    galleryCropper: null,
    galleryTargetFilename: null,
    galleryTargetOriginal: null,
    galleryTargetCardEl: null,

    // Per-image tracking keyed by upload_filename
    // values: 'unprocessed' | 'used-single' | 'used-diptych'
    imageStatus: {},
    // values: array of { download_url, suggested_filename, type: 'single'|'diptych' }
    processedOutputs: {},
};

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------
function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = `${url}?name=${encodeURIComponent(filename)}`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function $(id) { return document.getElementById(id); }

function showPhase(name) {
    ['setup', 'wide', 'narrow', 'gallery'].forEach(p => {
        $(`phase-${p}`).style.display = (p === name) ? '' : 'none';
    });
    document.querySelectorAll('.phase-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.phase === name);
    });
}

function setStatus(elId, msg, type) {
    const el = $(elId);
    if (!el) return;
    el.textContent = msg;
    el.className = `status-message ${type || ''}`;
    el.style.display = msg ? '' : 'none';
}

// ---------------------------------------------------------------------------
// Phase tabs
// ---------------------------------------------------------------------------
function initPhaseTabs() {
    document.querySelectorAll('.phase-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            showPhase(btn.dataset.phase);
            if (btn.dataset.phase === 'gallery') renderGallery();
            if (btn.dataset.phase === 'narrow') renderNarrowGrid();
        });
    });
}

function enableTab(name) {
    const btn = $(`tab-${name}`);
    if (btn) btn.disabled = false;
}

// ---------------------------------------------------------------------------
// Setup phase
// ---------------------------------------------------------------------------
function initSetup() {
    const folderInput = $('folder-path');
    const thresholdSlider = $('aspect-threshold');
    const thresholdDisplay = $('threshold-display');
    const scanBtn = $('scan-btn');

    folderInput.addEventListener('input', () => {
        bulkState.folderPath = folderInput.value.trim();
        updateScanBtnState();
    });

    thresholdSlider.addEventListener('input', () => {
        bulkState.aspectThreshold = parseFloat(thresholdSlider.value);
        thresholdDisplay.textContent = bulkState.aspectThreshold.toFixed(2);
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            bulkState.preset = btn.dataset.preset;
            bulkState.presetData = {
                width: parseInt(btn.dataset.width),
                height: parseInt(btn.dataset.height),
                name: btn.dataset.name,
            };
            updateScanBtnState();
        });
    });

    scanBtn.addEventListener('click', scanFolder);
}

function updateScanBtnState() {
    $('scan-btn').disabled = !(bulkState.folderPath && bulkState.preset);
}

async function scanFolder() {
    setStatus('scan-status', 'Scanning folder...', 'loading');
    $('scan-btn').disabled = true;

    try {
        const resp = await fetch('/bulk/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                folder_path: bulkState.folderPath,
                aspect_threshold: bulkState.aspectThreshold,
                preset: bulkState.preset,
            }),
        });
        const data = await resp.json();

        if (!resp.ok || !data.success) {
            setStatus('scan-status', data.error || 'Scan failed', 'error');
            $('scan-btn').disabled = false;
            return;
        }

        bulkState.wideImages = data.wide;
        bulkState.narrowImages = data.narrow;

        // Init status tracking
        [...data.wide, ...data.narrow].forEach(img => {
            bulkState.imageStatus[img.upload_filename] = 'unprocessed';
            bulkState.processedOutputs[img.upload_filename] = [];
        });

        const skippedNote = data.skipped.length
            ? ` (${data.skipped.length} file(s) skipped)`
            : '';
        setStatus('scan-status',
            `Found ${data.total} image(s): ${data.wide_count} wide, ${data.narrow_count} narrow.${skippedNote}`,
            'success');

        // Update tab counts
        $('tab-wide-count').textContent = data.wide_count;
        $('tab-narrow-count').textContent = data.narrow_count;

        // Show tab nav and enable available tabs
        $('phase-tabs').style.display = '';
        enableTab('gallery');
        if (data.wide_count > 0) enableTab('wide');
        if (data.narrow_count > 0) enableTab('narrow');

        // Auto-advance
        if (data.wide_count > 0) {
            bulkState.wideIndex = 0;
            showPhase('wide');
            loadWideImage(0);
        } else if (data.narrow_count > 0) {
            showPhase('narrow');
            renderNarrowGrid();
        } else {
            showPhase('gallery');
            renderGallery();
        }

    } catch (err) {
        setStatus('scan-status', `Network error: ${err.message}`, 'error');
        $('scan-btn').disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Wide phase
// ---------------------------------------------------------------------------
function initWidePhase() {
    $('wide-process-btn').addEventListener('click', processWideImage);
    $('wide-skip-btn').addEventListener('click', () => advanceWide(false));
    $('wide-done-btn').addEventListener('click', transitionToNarrow);

    $('wide-letterbox').addEventListener('change', e => {
        bulkState.wideLetterbox = e.target.checked;
        if (bulkState.wideCropper) reinitWideCropper();
    });
}

function loadWideImage(index) {
    const img = bulkState.wideImages[index];
    if (!img) return;

    // Always reset letterbox to off for each new image
    bulkState.wideLetterbox = false;
    $('wide-letterbox').checked = false;

    const total = bulkState.wideImages.length;
    $('wide-progress').textContent = `Image ${index + 1} of ${total}`;
    $('wide-filename').textContent = img.original_filename;
    setStatus('wide-status', '', '');

    if (bulkState.wideCropper) {
        bulkState.wideCropper.destroy();
        bulkState.wideCropper = null;
    }

    const cropImg = $('wide-crop-image');
    cropImg.src = '';
    // Force image reload (avoid browser cache serving stale dimensions)
    cropImg.src = img.url + '?t=' + Date.now();

    cropImg.onload = () => {
        const aspectRatio = bulkState.wideLetterbox
            ? NaN
            : bulkState.presetData.width / bulkState.presetData.height;

        bulkState.wideCropper = new Cropper(cropImg, {
            aspectRatio: isNaN(aspectRatio) ? NaN : aspectRatio,
            viewMode: 1,
            autoCropArea: 1,
            movable: true,
            crop(event) {
                updateWideCropInfo(event.detail);
            },
        });
    };
}

function reinitWideCropper() {
    const img = bulkState.wideImages[bulkState.wideIndex];
    if (!img) return;
    if (bulkState.wideCropper) {
        bulkState.wideCropper.destroy();
        bulkState.wideCropper = null;
    }
    const cropImg = $('wide-crop-image');
    const aspectRatio = bulkState.wideLetterbox
        ? NaN
        : bulkState.presetData.width / bulkState.presetData.height;

    bulkState.wideCropper = new Cropper(cropImg, {
        aspectRatio: isNaN(aspectRatio) ? NaN : aspectRatio,
        viewMode: 1,
        autoCropArea: 1,
        movable: true,
        crop(event) {
            updateWideCropInfo(event.detail);
        },
    });
}

function updateWideCropInfo(detail) {
    const w = Math.round(detail.width);
    const h = Math.round(detail.height);
    let info = `Crop: ${w} &times; ${h}px`;
    if (bulkState.wideLetterbox && w > 0 && h > 0) {
        const { width: tw, height: th } = bulkState.presetData;
        const scale = Math.min(tw / w, th / h);
        const nw = Math.round(w * scale);
        const nh = Math.round(h * scale);
        const padX = Math.round((tw - nw) / 2);
        const padY = Math.round((th - nh) / 2);
        if (padX > 0) info += ` &mdash; Pillarbox: ${padX}px bars left &amp; right`;
        if (padY > 0) info += ` &mdash; Letterbox: ${padY}px bars top &amp; bottom`;
    }
    $('wide-crop-info').innerHTML = info;
}

async function processWideImage() {
    if (!bulkState.wideCropper) return;
    const img = bulkState.wideImages[bulkState.wideIndex];
    const cropData = bulkState.wideCropper.getData(true);

    $('wide-process-btn').disabled = true;
    setStatus('wide-status', 'Processing...', 'loading');

    try {
        const resp = await fetch('/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: img.upload_filename,
                original_filename: img.original_filename,
                preset: bulkState.preset,
                crop: { x: cropData.x, y: cropData.y, width: cropData.width, height: cropData.height },
                letterbox: bulkState.wideLetterbox,
            }),
        });
        const data = await resp.json();

        if (!resp.ok || !data.success) {
            setStatus('wide-status', data.error || 'Processing failed', 'error');
            $('wide-process-btn').disabled = false;
            return;
        }

        bulkState.imageStatus[img.upload_filename] = 'used-single';
        bulkState.processedOutputs[img.upload_filename].push({
            download_url: data.download_url,
            suggested_filename: data.suggested_filename,
            type: 'single',
        });

        triggerDownload(data.download_url, data.suggested_filename);
        setStatus('wide-status', `Saved: ${data.suggested_filename}`, 'success');
        advanceWide(true);

    } catch (err) {
        setStatus('wide-status', `Network error: ${err.message}`, 'error');
        $('wide-process-btn').disabled = false;
    }
}

function advanceWide(wasProcessed) {
    $('wide-process-btn').disabled = false;
    bulkState.wideIndex++;
    if (bulkState.wideIndex < bulkState.wideImages.length) {
        loadWideImage(bulkState.wideIndex);
    } else {
        transitionToNarrow();
    }
}

function transitionToNarrow() {
    if (bulkState.wideCropper) {
        bulkState.wideCropper.destroy();
        bulkState.wideCropper = null;
    }
    if (bulkState.narrowImages.length > 0) {
        showPhase('narrow');
        renderNarrowGrid();
    } else {
        showPhase('gallery');
        renderGallery();
    }
}

// ---------------------------------------------------------------------------
// Narrow phase
// ---------------------------------------------------------------------------
function initNarrowPhase() {
    $('narrow-done-btn').addEventListener('click', () => {
        showPhase('gallery');
        renderGallery();
    });

    $('narrow-gap-slider').addEventListener('input', e => {
        bulkState.narrowGapPercent = parseFloat(e.target.value);
        $('narrow-gap-display').textContent = bulkState.narrowGapPercent;
        if (bulkState.narrowCropper1 && bulkState.narrowCrop1Data) {
            $('narrow-refresh-bar').style.display = '';
        }
    });

    $('narrow-refresh-btn').addEventListener('click', () => {
        $('narrow-refresh-bar').style.display = 'none';
        if (bulkState.narrowCrop1Data) {
            initNarrowCropper2();
        }
    });

    $('narrow-process-btn').addEventListener('click', processNarrowPair);
    $('narrow-cancel-btn').addEventListener('click', cancelNarrowSelection);
}

function renderNarrowGrid() {
    const grid = $('narrow-grid');
    grid.innerHTML = '';

    bulkState.narrowImages.forEach((img, idx) => {
        const status = bulkState.imageStatus[img.upload_filename];
        const isUsed = status === 'used-diptych';
        const isSelected = bulkState.selectedNarrowIndices.includes(idx);

        const card = document.createElement('div');
        card.className = 'thumb-card' +
            (isUsed ? ' used-diptych' : '') +
            (isSelected ? ' selected' : '');
        card.dataset.idx = idx;

        const thumb = document.createElement('img');
        thumb.src = img.url;
        thumb.alt = img.original_filename;
        thumb.loading = 'lazy';

        const label = document.createElement('p');
        label.className = 'thumb-label';
        label.textContent = img.original_filename;

        const badge = document.createElement('span');
        badge.className = `status-badge status-${status.replace('-', '')}`;
        badge.textContent = statusLabel(status);

        card.appendChild(thumb);
        card.appendChild(label);
        card.appendChild(badge);

        if (!isUsed) {
            card.addEventListener('click', () => toggleNarrowSelection(idx));
        }

        grid.appendChild(card);
    });
}

function statusLabel(status) {
    if (status === 'used-single') return 'Single';
    if (status === 'used-diptych') return 'Diptych';
    return 'Unused';
}

function toggleNarrowSelection(idx) {
    const pos = bulkState.selectedNarrowIndices.indexOf(idx);
    if (pos >= 0) {
        bulkState.selectedNarrowIndices.splice(pos, 1);
    } else {
        if (bulkState.selectedNarrowIndices.length >= 2) return;
        bulkState.selectedNarrowIndices.push(idx);
    }
    renderNarrowGrid();
    if (bulkState.selectedNarrowIndices.length === 2) {
        openDiptychCrop();
    } else {
        closeDiptychPanel();
    }
}

function openDiptychCrop() {
    const [idx1, idx2] = bulkState.selectedNarrowIndices;
    const img1 = bulkState.narrowImages[idx1];
    const img2 = bulkState.narrowImages[idx2];

    $('diptych-label-1').textContent = img1.original_filename;
    $('diptych-label-2').textContent = img2.original_filename;
    $('diptych-panel').style.display = '';
    $('narrow-refresh-bar').style.display = 'none';
    setStatus('narrow-status', '', '');

    // Reset gap to 1
    bulkState.narrowGapPercent = 1;
    $('narrow-gap-slider').value = 1;
    $('narrow-gap-display').textContent = 1;

    // Init cropper 1
    if (bulkState.narrowCropper1) { bulkState.narrowCropper1.destroy(); bulkState.narrowCropper1 = null; }
    if (bulkState.narrowCropper2) { bulkState.narrowCropper2.destroy(); bulkState.narrowCropper2 = null; }
    bulkState.narrowCrop1Data = null;

    const cropImg1 = $('narrow-crop-image-1');
    cropImg1.src = img1.url + '?t=' + Date.now();
    cropImg1.onload = () => {
        const targetAspect = bulkState.presetData.width / bulkState.presetData.height;
        // For portrait images, a tall aspect is natural — use preset height ratio
        // We'll lock image1 to a tall sub-ratio. Use free aspect until crop is ready.
        bulkState.narrowCropper1 = new Cropper(cropImg1, {
            aspectRatio: NaN,
            viewMode: 1,
            autoCropArea: 1,
            movable: true,
            cropend() {
                bulkState.narrowCrop1Data = bulkState.narrowCropper1.getData(true);
                $('narrow-refresh-bar').style.display = '';
                updateNarrowCropInfo1();
            },
            crop(event) {
                updateNarrowCropInfo1(event.detail);
            },
        });
    };

    const cropImg2 = $('narrow-crop-image-2');
    cropImg2.src = img2.url + '?t=' + Date.now();
    cropImg2.onload = () => {
        // Wait for cropper1 to be ready before computing ratio
        // Use a small delay to let cropper1 initialize
        setTimeout(() => {
            bulkState.narrowCrop1Data = bulkState.narrowCropper1
                ? bulkState.narrowCropper1.getData(true)
                : null;
            initNarrowCropper2();
        }, 200);
    };
}

function computeImage2Ratio() {
    const { width: tw, height: th } = bulkState.presetData;
    const crop1 = bulkState.narrowCrop1Data;
    if (!crop1 || !crop1.width || !crop1.height) return null;

    const sw1 = crop1.width * th / crop1.height;
    const gap = tw * bulkState.narrowGapPercent / 100;
    const sw2 = tw - gap - sw1;
    if (sw2 <= 0) return null;
    return sw2 / th;
}

function initNarrowCropper2() {
    if (bulkState.narrowCropper2) {
        bulkState.narrowCropper2.destroy();
        bulkState.narrowCropper2 = null;
    }

    const ratio = computeImage2Ratio();
    const cropImg2 = $('narrow-crop-image-2');

    bulkState.narrowCropper2 = new Cropper(cropImg2, {
        aspectRatio: ratio || NaN,
        viewMode: 1,
        autoCropArea: 1,
        movable: true,
        zoomable: false,
        crop(event) {
            updateNarrowCropInfo2(event.detail);
        },
    });
}

function updateNarrowCropInfo1(detail) {
    if (!detail) {
        detail = bulkState.narrowCropper1 ? bulkState.narrowCropper1.getData(true) : null;
    }
    if (!detail) return;
    $('narrow-crop-info-1').textContent =
        `Crop: ${Math.round(detail.width)} × ${Math.round(detail.height)}px`;
}

function updateNarrowCropInfo2(detail) {
    if (!detail) return;
    $('narrow-crop-info-2').textContent =
        `Crop: ${Math.round(detail.width)} × ${Math.round(detail.height)}px`;
}

function closeDiptychPanel() {
    $('diptych-panel').style.display = 'none';
    if (bulkState.narrowCropper1) { bulkState.narrowCropper1.destroy(); bulkState.narrowCropper1 = null; }
    if (bulkState.narrowCropper2) { bulkState.narrowCropper2.destroy(); bulkState.narrowCropper2 = null; }
    bulkState.narrowCrop1Data = null;
}

function cancelNarrowSelection() {
    bulkState.selectedNarrowIndices = [];
    closeDiptychPanel();
    renderNarrowGrid();
}

async function processNarrowPair() {
    if (!bulkState.narrowCropper1 || !bulkState.narrowCropper2) return;
    const [idx1, idx2] = bulkState.selectedNarrowIndices;
    const img1 = bulkState.narrowImages[idx1];
    const img2 = bulkState.narrowImages[idx2];

    const crop1 = bulkState.narrowCropper1.getData(true);
    const crop2 = bulkState.narrowCropper2.getData(true);

    $('narrow-process-btn').disabled = true;
    setStatus('narrow-status', 'Processing diptych...', 'loading');

    try {
        const resp = await fetch('/process-diptych', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename1: img1.upload_filename,
                filename2: img2.upload_filename,
                original_filename1: img1.original_filename,
                original_filename2: img2.original_filename,
                preset: bulkState.preset,
                crop1: { x: crop1.x, y: crop1.y, width: crop1.width, height: crop1.height },
                crop2: { x: crop2.x, y: crop2.y, width: crop2.width, height: crop2.height },
                gap_percent: bulkState.narrowGapPercent,
            }),
        });
        const data = await resp.json();

        if (!resp.ok || !data.success) {
            setStatus('narrow-status', data.error || 'Processing failed', 'error');
            $('narrow-process-btn').disabled = false;
            return;
        }

        // Mark both images as used
        bulkState.imageStatus[img1.upload_filename] = 'used-diptych';
        bulkState.imageStatus[img2.upload_filename] = 'used-diptych';

        const outputRecord = {
            download_url: data.download_url,
            suggested_filename: data.suggested_filename,
            type: 'diptych',
        };
        bulkState.processedOutputs[img1.upload_filename].push(outputRecord);
        bulkState.processedOutputs[img2.upload_filename].push(outputRecord);

        triggerDownload(data.download_url, data.suggested_filename);

        // Reset selection and close panel
        bulkState.selectedNarrowIndices = [];
        closeDiptychPanel();
        setStatus('narrow-status', '', '');
        $('narrow-process-btn').disabled = false;

        // Re-render grid with updated status
        renderNarrowGrid();

    } catch (err) {
        setStatus('narrow-status', `Network error: ${err.message}`, 'error');
        $('narrow-process-btn').disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Gallery phase
// ---------------------------------------------------------------------------
function renderGallery() {
    const grid = $('gallery-grid');
    grid.innerHTML = '';

    const allImages = [...bulkState.wideImages, ...bulkState.narrowImages];

    allImages.forEach(img => {
        const status = bulkState.imageStatus[img.upload_filename];
        const outputs = bulkState.processedOutputs[img.upload_filename] || [];

        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.dataset.filename = img.upload_filename;

        const thumb = document.createElement('img');
        thumb.src = img.url;
        thumb.alt = img.original_filename;
        thumb.className = 'gallery-thumb';
        thumb.loading = 'lazy';

        const info = document.createElement('div');
        info.className = 'gallery-info';

        const fname = document.createElement('p');
        fname.className = 'gallery-filename';
        fname.textContent = img.original_filename;

        const badge = document.createElement('span');
        badge.className = `status-badge status-${status.replace(/-/g, '')}`;
        badge.textContent = statusLabel(status);

        const dims = document.createElement('p');
        dims.className = 'gallery-dims';
        dims.textContent = `${img.width} × ${img.height}`;

        info.appendChild(fname);
        info.appendChild(badge);
        info.appendChild(dims);

        // Download links for existing outputs
        const outputsEl = document.createElement('div');
        outputsEl.className = 'gallery-outputs';

        // De-duplicate outputs by download_url to avoid double entries for diptych partners
        const seen = new Set();
        outputs.forEach(out => {
            if (seen.has(out.download_url)) return;
            seen.add(out.download_url);

            const link = document.createElement('a');
            link.href = `${out.download_url}?name=${encodeURIComponent(out.suggested_filename)}`;
            link.className = 'btn btn-success btn-sm download-link';
            link.textContent = `Download ${out.type === 'diptych' ? 'Diptych' : 'Single'}`;
            link.download = out.suggested_filename;
            outputsEl.appendChild(link);
        });

        // "Process Again" button
        const reprocessBtn = document.createElement('button');
        reprocessBtn.className = 'btn btn-secondary btn-sm';
        reprocessBtn.textContent = 'Process Again (Single)';
        reprocessBtn.addEventListener('click', () => openGalleryCrop(img, card));
        outputsEl.appendChild(reprocessBtn);

        card.appendChild(thumb);
        card.appendChild(info);
        card.appendChild(outputsEl);

        grid.appendChild(card);
    });
}

function openGalleryCrop(img, cardEl) {
    if (bulkState.galleryCropper) {
        bulkState.galleryCropper.destroy();
        bulkState.galleryCropper = null;
    }

    bulkState.galleryTargetFilename = img.upload_filename;
    bulkState.galleryTargetOriginal = img.original_filename;
    bulkState.galleryTargetCardEl = cardEl;

    $('gallery-crop-title').textContent = `Process Again: ${img.original_filename}`;
    $('gallery-letterbox').checked = false;
    setStatus('gallery-process-status', '', '');

    const overlay = $('gallery-crop-overlay');
    overlay.style.display = '';

    // Scroll overlay into view
    overlay.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const cropImg = $('gallery-crop-image');
    cropImg.src = img.url + '?t=' + Date.now();
    cropImg.onload = () => {
        const aspectRatio = bulkState.presetData.width / bulkState.presetData.height;
        bulkState.galleryCropper = new Cropper(cropImg, {
            aspectRatio,
            viewMode: 1,
            autoCropArea: 1,
            movable: true,
            crop(event) {
                const d = event.detail;
                $('gallery-crop-info').textContent =
                    `Crop: ${Math.round(d.width)} × ${Math.round(d.height)}px`;
            },
        });
    };
}

function initGalleryPhase() {
    $('gallery-crop-close').addEventListener('click', closeGalleryCrop);

    $('gallery-letterbox').addEventListener('change', e => {
        if (!bulkState.galleryCropper) return;
        bulkState.galleryCropper.destroy();
        bulkState.galleryCropper = null;
        const cropImg = $('gallery-crop-image');
        const ratio = e.target.checked
            ? NaN
            : bulkState.presetData.width / bulkState.presetData.height;
        bulkState.galleryCropper = new Cropper(cropImg, {
            aspectRatio: ratio,
            viewMode: 1,
            autoCropArea: 1,
            movable: true,
        });
    });

    $('gallery-process-btn').addEventListener('click', processGalleryImage);
}

function closeGalleryCrop() {
    if (bulkState.galleryCropper) {
        bulkState.galleryCropper.destroy();
        bulkState.galleryCropper = null;
    }
    $('gallery-crop-overlay').style.display = 'none';
}

async function processGalleryImage() {
    if (!bulkState.galleryCropper) return;
    const cropData = bulkState.galleryCropper.getData(true);
    const letterbox = $('gallery-letterbox').checked;

    $('gallery-process-btn').disabled = true;
    setStatus('gallery-process-status', 'Processing...', 'loading');

    try {
        const resp = await fetch('/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: bulkState.galleryTargetFilename,
                original_filename: bulkState.galleryTargetOriginal,
                preset: bulkState.preset,
                crop: { x: cropData.x, y: cropData.y, width: cropData.width, height: cropData.height },
                letterbox,
            }),
        });
        const data = await resp.json();

        if (!resp.ok || !data.success) {
            setStatus('gallery-process-status', data.error || 'Processing failed', 'error');
            $('gallery-process-btn').disabled = false;
            return;
        }

        // Append new output; don't change existing status
        bulkState.processedOutputs[bulkState.galleryTargetFilename].push({
            download_url: data.download_url,
            suggested_filename: data.suggested_filename,
            type: 'single',
        });
        // If previously unprocessed, mark as single
        if (bulkState.imageStatus[bulkState.galleryTargetFilename] === 'unprocessed') {
            bulkState.imageStatus[bulkState.galleryTargetFilename] = 'used-single';
        }

        triggerDownload(data.download_url, data.suggested_filename);
        setStatus('gallery-process-status',
            `Saved: ${data.suggested_filename}`, 'success');

        $('gallery-process-btn').disabled = false;

        // Refresh gallery card
        renderGallery();

    } catch (err) {
        setStatus('gallery-process-status', `Network error: ${err.message}`, 'error');
        $('gallery-process-btn').disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initPhaseTabs();
    initSetup();
    initWidePhase();
    initNarrowPhase();
    initGalleryPhase();
});
