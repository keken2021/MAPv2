/* 
  file summary: universal image cropping and sizing helper utilities for vessel profile and gallery images.
  responsibilities: enforces standardized universal aspect ratios (16:9 universal standard, 4:3 photo, 3:2 marketplace, 1:1 avatar) with client-side canvas crop, zoom, rotation, and high-DPI compression.
  role in system: consumed by VesselImageCropModal, VesselModal, and VesselDetailView.
*/

export type VesselImageCropPreset = '16:9' | '4:3' | '3:2' | '1:1' | 'free';

export interface UniversalCropPresetInfo {
  id: VesselImageCropPreset;
  label: string;
  aspectRatio: number;
  width: number;
  height: number;
  description: string;
  recommendedFor: string;
}

export interface CropTransform {
  zoom: number;
  panX: number; // in pixels
  panY: number; // in pixels
  rotate: number; // 0, 90, 180, 270 degrees
  flipH: boolean;
  boxWidth?: number;
  boxHeight?: number;
}

export interface ImageCropValidationResult {
  valid: boolean;
  error?: string;
  fileSizeFormatted?: string;
}

/** Universal vessel image presets aligned with maritime card and hero grid taxonomy */
export const UNIVERSAL_VESSEL_PRESETS: Record<VesselImageCropPreset, UniversalCropPresetInfo> = {
  '16:9': {
    id: '16:9',
    label: '16:9 Universal Standard',
    aspectRatio: 16 / 9,
    width: 1200,
    height: 675,
    description: 'Universal Vessel Banner & Hero Card (Universal Default)',
    recommendedFor: 'Vessel Cover, Header & Fleet Cards',
  },
  '4:3': {
    id: '4:3',
    label: '4:3 Standard Photo',
    aspectRatio: 4 / 3,
    width: 1024,
    height: 768,
    description: 'Standard Maritime Document & Survey Photo',
    recommendedFor: 'Technical Survey & Equipment Logs',
  },
  '3:2': {
    id: '3:2',
    label: '3:2 Classic Tile',
    aspectRatio: 3 / 2,
    width: 1200,
    height: 800,
    description: 'Classic Maritime Marketplace Framing',
    recommendedFor: 'Marketplace Grid & Spec Sheets',
  },
  '1:1': {
    id: '1:1',
    label: '1:1 Square Thumbnail',
    aspectRatio: 1,
    width: 600,
    height: 600,
    description: 'Square Vessel Avatar & Icon',
    recommendedFor: 'Table List Rows & Mini Badges',
  },
  'free': {
    id: 'free',
    label: 'Original / Freeform',
    aspectRatio: 0,
    width: 1200,
    height: 900,
    description: 'Preserves original aspect ratio with universal scaling',
    recommendedFor: 'Custom Technical Schematics & Blueprints',
  },
};

export const DEFAULT_UNIVERSAL_PRESET: VesselImageCropPreset = '16:9';

/** Formats byte size into readable KB / MB string */
export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/** Validates user uploaded image file */
export const validateImageFile = (
  file: File,
  maxSizeBytes: number = 25 * 1024 * 1024, // 25 MB
): ImageCropValidationResult => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: `Unsupported file format (${file.type || 'unknown'}). Please upload JPEG, PNG, or WEBP images.`,
      fileSizeFormatted: formatFileSize(file.size),
    };
  }
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds the ${formatFileSize(maxSizeBytes)} limit. Current file is ${formatFileSize(file.size)}.`,
      fileSizeFormatted: formatFileSize(file.size),
    };
  }
  return {
    valid: true,
    fileSizeFormatted: formatFileSize(file.size),
  };
};

/**
 * Calculates center crop bounding box for a given source dimensions and aspect ratio
 */
export const calculateCenterCropBounds = (
  sourceWidth: number,
  sourceHeight: number,
  targetAspectRatio: number,
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } => {
  if (targetAspectRatio <= 0 || sourceWidth <= 0 || sourceHeight <= 0) {
    return { cropX: 0, cropY: 0, cropWidth: sourceWidth, cropHeight: sourceHeight };
  }

  const sourceAspect = sourceWidth / sourceHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceAspect > targetAspectRatio) {
    // Source is wider than target aspect: crop sides
    cropWidth = Math.round(sourceHeight * targetAspectRatio);
    cropHeight = sourceHeight;
  } else {
    // Source is taller than target aspect: crop top & bottom
    cropWidth = sourceWidth;
    cropHeight = Math.round(sourceWidth / targetAspectRatio);
  }

  const cropX = Math.round((sourceWidth - cropWidth) / 2);
  const cropY = Math.round((sourceHeight - cropHeight) / 2);

  return { cropX, cropY, cropWidth, cropHeight };
};

/**
 * Helper to load an image element from URL or DataURL safely in a Promise
 */
export const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Failed to load image from source: ${err}`));
    img.src = src;
  });
};

/**
 * Calculates the unscaled base display size of an image covering the crop box
 */
export const getBaseImageDisplaySize = (
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number = 520,
  boxHeight: number = 292.5,
): { width: number; height: number } => {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: boxWidth, height: boxHeight };
  }
  const imgAspect = naturalWidth / naturalHeight;
  const boxAspect = boxWidth / boxHeight;

  if (imgAspect >= boxAspect) {
    // Wider than box: height fills box, width expands
    return {
      width: boxHeight * imgAspect,
      height: boxHeight,
    };
  } else {
    // Taller than box: width fills box, height expands
    return {
      width: boxWidth,
      height: boxWidth / imgAspect,
    };
  }
};

/**
 * Clamps pan offsets to ensure the crop viewport stays strictly within the image boundaries (preventing empty/outside crop areas).
 */
export const clampCropPan = (
  pan: { x: number; y: number },
  zoom: number,
  naturalWidth: number,
  naturalHeight: number,
  boxWidth: number = 520,
  boxHeight: number = 292.5,
  rotate: number = 0,
): { x: number; y: number } => {
  if (naturalWidth <= 0 || naturalHeight <= 0) return { x: 0, y: 0 };

  const baseSize = getBaseImageDisplaySize(naturalWidth, naturalHeight, boxWidth, boxHeight);
  const isRotated90or270 = Math.abs(rotate) % 180 !== 0;

  let currentW = baseSize.width * zoom;
  let currentH = baseSize.height * zoom;

  if (isRotated90or270) {
    const rotScale = Math.max(boxWidth / baseSize.height, boxHeight / baseSize.width);
    currentW = baseSize.height * zoom * rotScale;
    currentH = baseSize.width * zoom * rotScale;
  }

  const maxPanX = Math.max(0, (currentW - boxWidth) / 2);
  const maxPanY = Math.max(0, (currentH - boxHeight) / 2);

  const clampedX = Math.max(-maxPanX, Math.min(maxPanX, pan.x));
  const clampedY = Math.max(-maxPanY, Math.min(maxPanY, pan.y));

  return {
    x: Math.abs(clampedX) < 1e-6 ? 0 : clampedX,
    y: Math.abs(clampedY) < 1e-6 ? 0 : clampedY,
  };
};

/**
 * Renders a transformed and cropped image onto an HTML5 canvas and exports a high quality Data URL.
 */
export const renderCroppedImageToDataUrl = (
  img: HTMLImageElement,
  preset: VesselImageCropPreset,
  transform: CropTransform,
  outputQuality: number = 0.92,
  outputMimeType: string = 'image/jpeg',
): string => {
  const presetInfo = UNIVERSAL_VESSEL_PRESETS[preset] || UNIVERSAL_VESSEL_PRESETS['16:9'];
  const targetWidth = presetInfo.width;
  const targetHeight = preset === 'free'
    ? Math.round(targetWidth / ((img.naturalWidth || img.width) / (img.naturalHeight || img.height) || (16 / 9)))
    : presetInfo.height;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available');
  }

  // Smooth rendering setup
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill neutral dark background
  ctx.fillStyle = '#0b1b2b';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Save context state for transformations
  ctx.save();

  // Move origin to center of output canvas
  ctx.translate(targetWidth / 2, targetHeight / 2);

  // Determine viewport box dimensions matching DOM measurement
  const previewBoxWidth = transform.boxWidth && transform.boxWidth > 0 ? transform.boxWidth : targetWidth;
  const previewBoxHeight = transform.boxHeight && transform.boxHeight > 0 ? transform.boxHeight : targetHeight;
  const S = targetWidth / previewBoxWidth;

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  const baseSize = getBaseImageDisplaySize(
    naturalWidth,
    naturalHeight,
    previewBoxWidth,
    previewBoxHeight,
  );

  const isRotated90or270 = Math.abs(transform.rotate) % 180 !== 0;
  const rotScale = isRotated90or270
    ? Math.max(previewBoxWidth / baseSize.height, previewBoxHeight / baseSize.width)
    : 1.0;
  const zoom = transform.zoom || 1.0;

  // Clamped pan offsets in viewport coordinates
  const clampedPan = clampCropPan(
    { x: transform.panX || 0, y: transform.panY || 0 },
    zoom,
    naturalWidth,
    naturalHeight,
    previewBoxWidth,
    previewBoxHeight,
    transform.rotate || 0,
  );

  // Apply screen pan offset (in canvas pixel scale) BEFORE rotation/flip, matching CSS transform order
  ctx.translate(clampedPan.x * S, clampedPan.y * S);

  // Apply user rotation (in radians) around centered & panned anchor
  if (transform.rotate) {
    ctx.rotate((transform.rotate * Math.PI) / 180);
  }

  // Apply flip
  if (transform.flipH) {
    ctx.scale(-1, 1);
  }

  // Draw image centered at origin
  const drawWidth = baseSize.width * S * zoom * rotScale;
  const drawHeight = baseSize.height * S * zoom * rotScale;

  ctx.drawImage(
    img,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight,
  );

  ctx.restore();

  return canvas.toDataURL(outputMimeType, outputQuality);
};

/**
 * Auto-crops and standardizes any raw file or data URL into the Universal Vessel 16:9 format
 */
export const autoStandardizeVesselImage = async (
  imageSource: string | File,
  preset: VesselImageCropPreset = DEFAULT_UNIVERSAL_PRESET,
  quality: number = 0.9,
): Promise<string> => {
  let dataUrl = '';
  if (typeof imageSource === 'string') {
    dataUrl = imageSource;
  } else {
    dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(imageSource);
    });
  }

  const img = await loadImageElement(dataUrl);
  const defaultTransform: CropTransform = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    rotate: 0,
    flipH: false,
  };

  return renderCroppedImageToDataUrl(img, preset, defaultTransform, quality);
};
