import { getToken } from '../utils/safeStorage.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

export const MAX_FILE_SIZES = {
  IMAGE: 10 * 1024 * 1024,   // 10MB
  DOCUMENT: 10 * 1024 * 1024 // 10MB
};

export const SUPPORTED_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
};

function getFileCategory(file) {
  if (SUPPORTED_TYPES.IMAGE.includes(file.type)) return 'IMAGE';
  if (SUPPORTED_TYPES.DOCUMENT.includes(file.type)) return 'DOCUMENT';
  return null;
}

/**
 * Validate a single evidence file
 */
export function validateEvidenceFile(file) {
  const errors = [];

  const category = getFileCategory(file);
  if (!category) {
    errors.push('Unsupported file type');
    return { isValid: false, errors };
  }

  const maxSize = MAX_FILE_SIZES[category];
  if (file.size > maxSize) {
    errors.push(`File exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Upload a single evidence file
 */
export async function uploadEvidence(file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.evidenceType) formData.append('evidenceType', options.evidenceType);
  if (options.submittedBy) formData.append('submittedBy', options.submittedBy);

  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/evidence/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.message || 'Evidence upload failed');
  }

  return response.json();
}

/**
 * Upload multiple evidence files with progress callbacks
 */
export async function uploadMultipleEvidence(files, options = {}) {
  const { onFileProgress, onOverallProgress, evidenceType, submittedBy } = options;
  const results = { evidence: [], errors: [] };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    if (onOverallProgress) {
      onOverallProgress({
        stage: 'uploading',
        progress: Math.round((i / files.length) * 100),
        currentFile: i + 1,
        totalFiles: files.length,
        fileName: file.name
      });
    }

    try {
      const result = await uploadEvidence(file, { evidenceType, submittedBy });
      const category = getFileCategory(file);

      results.evidence.push({
        id: result.evidenceId || result.id || `evidence_${Date.now()}_${i}`,
        fileName: file.name,
        fileSize: file.size,
        fileUrl: result.fileUrl || result.url,
        ipfsHash: result.ipfsHash,
        category,
        description: result.description || '',
        uploadedAt: new Date().toISOString()
      });
    } catch (error) {
      results.errors.push({ fileName: file.name, error: error.message });
    }
  }

  if (onOverallProgress) {
    onOverallProgress({ stage: 'complete', progress: 100 });
  }

  return results;
}

/**
 * Capture a screenshot as evidence using the browser Screen Capture API
 */
export async function captureScreenshotEvidence(description = '') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser');
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  const track = stream.getVideoTracks()[0];

  const canvas = document.createElement('canvas');
  const video = document.createElement('video');
  video.srcObject = stream;
  await video.play();

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  track.stop();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' });

  const result = await uploadEvidence(file, { evidenceType: 'SCREENSHOT' });

  return {
    evidence: {
      id: result.evidenceId || result.id || `screenshot_${Date.now()}`,
      fileName: file.name,
      fileSize: file.size,
      fileUrl: result.fileUrl || result.url,
      ipfsHash: result.ipfsHash,
      category: 'IMAGE',
      description,
      uploadedAt: new Date().toISOString()
    }
  };
}

/**
 * Get a summary of uploaded evidence
 */
export async function getEvidenceSummary(evidenceIds) {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}/evidence/summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ evidenceIds })
  });

  if (!response.ok) {
    throw new Error('Failed to get evidence summary');
  }

  return response.json();
}
