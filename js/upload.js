/**
 * YMPRESSME — upload.js
 * File upload handler with drag-and-drop, preview, and validation.
 * Supports PNG, JPG, PDF, SVG files up to 50MB.
 */

const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf',
];
const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.svg', '.pdf'];
const MAX_SIZE_MB  = 50;

/**
 * Initialize a file upload area
 * @param {string} areaId - ID of the .upload-area element
 * @param {string} previewId - ID of the .upload-preview element
 * @param {string} inputId - ID of the hidden file input (optional, auto-detected)
 * @param {Function} onFileSelected - callback(file) when valid file chosen
 */
window.initUpload = function (areaId, previewId, inputId, onFileSelected) {
  const area    = document.getElementById(areaId);
  const preview = document.getElementById(previewId);
  const input   = inputId
    ? document.getElementById(inputId)
    : area && area.querySelector('input[type="file"]');

  if (!area || !input) return;

  let currentFile = null;

  /* --- Validate file --- */
  function validate(file) {
    if (!file) return 'No file selected.';
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const ok  = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
    if (!ok) return 'File type not supported. Please upload PNG, JPG, SVG, or PDF.';
    if (file.size > MAX_SIZE_MB * 1024 * 1024) return 'File is too large. Maximum size is ' + MAX_SIZE_MB + 'MB.';
    return null; // valid
  }

  /* --- Show preview --- */
  function showPreview(file) {
    if (!preview) return;
    const nameEl = preview.querySelector('.upload-preview-info strong');
    const sizeEl = preview.querySelector('.upload-preview-info span');
    const imgEl  = preview.querySelector('img');

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = formatSize(file.size);

    if (imgEl) {
      if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = function (e) { imgEl.src = e.target.result; imgEl.style.display = 'block'; };
        reader.readAsDataURL(file);
      } else {
        // Show icon for PDF/SVG
        imgEl.style.display = 'none';
        const parent = imgEl.parentElement;
        let icon = parent.querySelector('.file-type-icon');
        if (!icon) {
          icon = document.createElement('div');
          icon.className = 'file-type-icon';
          icon.style.cssText = 'font-size:2.5rem;flex-shrink:0;';
          parent.insertBefore(icon, imgEl);
        }
        icon.textContent = file.type === 'application/pdf' ? '📄' : '🎨';
      }
    }
    preview.classList.add('show');
  }

  /* --- Hide preview --- */
  function clearPreview() {
    if (!preview) return;
    preview.classList.remove('show');
    const imgEl = preview.querySelector('img');
    if (imgEl) { imgEl.src = ''; }
    const icon = preview.querySelector('.file-type-icon');
    if (icon) icon.remove();
    currentFile = null;
  }

  /* --- Handle file selection --- */
  function handleFile(file) {
    const err = validate(file);
    if (err) {
      window.showToast && window.showToast(err, 'error');
      return;
    }
    currentFile = file;
    showPreview(file);
    if (onFileSelected) onFileSelected(file);
  }

  /* --- Input change --- */
  input.addEventListener('change', function () {
    if (this.files && this.files[0]) handleFile(this.files[0]);
  });

  /* --- Drag & Drop --- */
  area.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('dragover');
  });
  area.addEventListener('dragleave', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
  });
  area.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
      // Sync dropped file back into the native input so the form handler can read it.
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch (ex) { /* not supported in all browsers */ }
    }
  });

  /* --- Remove button --- */
  if (preview) {
    const removeBtn = preview.querySelector('.upload-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        clearPreview();
        input.value = '';
        if (onFileSelected) onFileSelected(null);
      });
    }
  }

  /* --- Expose getter for current file --- */
  area._getFile = function () { return currentFile; };
};

/* ---- Helper: format bytes ---- */
function formatSize(bytes) {
  if (bytes < 1024)        return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
