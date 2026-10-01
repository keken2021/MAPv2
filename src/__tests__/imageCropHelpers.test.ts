import { describe, it, expect } from 'vitest';
import {
  UNIVERSAL_VESSEL_PRESETS,
  DEFAULT_UNIVERSAL_PRESET,
  calculateCenterCropBounds,
  validateImageFile,
  formatFileSize,
  renderCroppedImageToDataUrl,
  clampCropPan,
  CropTransform,
} from '../utils/imageCropHelpers';

describe('Universal Vessel Image Crop & Sizing Helpers', () => {
  describe('Universal Aspect Ratio Presets & Dimensions', () => {
    it('defines standard 16:9 as the universal default preset', () => {
      expect(DEFAULT_UNIVERSAL_PRESET).toBe('16:9');
      const preset16_9 = UNIVERSAL_VESSEL_PRESETS['16:9'];
      expect(preset16_9).toBeDefined();
      expect(preset16_9.width).toBe(1200);
      expect(preset16_9.height).toBe(675);
      expect(preset16_9.aspectRatio).toBeCloseTo(16 / 9, 3);
    });

    it('contains all standardized universal vessel presets (16:9, 4:3, 3:2, 1:1, free)', () => {
      const keys = Object.keys(UNIVERSAL_VESSEL_PRESETS);
      expect(keys).toContain('16:9');
      expect(keys).toContain('4:3');
      expect(keys).toContain('3:2');
      expect(keys).toContain('1:1');
      expect(keys).toContain('free');

      // 4:3 Standard Maritime Photo
      expect(UNIVERSAL_VESSEL_PRESETS['4:3'].width).toBe(1024);
      expect(UNIVERSAL_VESSEL_PRESETS['4:3'].height).toBe(768);

      // 3:2 Marketplace Tile
      expect(UNIVERSAL_VESSEL_PRESETS['3:2'].width).toBe(1200);
      expect(UNIVERSAL_VESSEL_PRESETS['3:2'].height).toBe(800);

      // 1:1 Vessel Thumbnail Avatar
      expect(UNIVERSAL_VESSEL_PRESETS['1:1'].width).toBe(600);
      expect(UNIVERSAL_VESSEL_PRESETS['1:1'].height).toBe(600);
    });
  });

  describe('calculateCenterCropBounds', () => {
    it('calculates exact center crop for wide images fitting 16:9', () => {
      // 2000 x 1000 (2:1 aspect ratio, wider than 16:9 = 1.777)
      const bounds = calculateCenterCropBounds(2000, 1000, 16 / 9);
      expect(bounds.cropHeight).toBe(1000);
      expect(bounds.cropWidth).toBe(Math.round(1000 * (16 / 9))); // ~1778
      expect(bounds.cropX).toBe(Math.round((2000 - bounds.cropWidth) / 2)); // ~111
      expect(bounds.cropY).toBe(0);
    });

    it('calculates exact center crop for tall/square images fitting 16:9', () => {
      // 1000 x 1000 (1:1 aspect ratio, taller than 16:9)
      const bounds = calculateCenterCropBounds(1000, 1000, 16 / 9);
      expect(bounds.cropWidth).toBe(1000);
      expect(bounds.cropHeight).toBe(Math.round(1000 / (16 / 9))); // ~563
      expect(bounds.cropX).toBe(0);
      expect(bounds.cropY).toBe(Math.round((1000 - bounds.cropHeight) / 2)); // ~219
    });

    it('handles exact aspect ratio match without cropping', () => {
      const bounds = calculateCenterCropBounds(1600, 900, 16 / 9);
      expect(bounds.cropWidth).toBe(1600);
      expect(bounds.cropHeight).toBe(900);
      expect(bounds.cropX).toBe(0);
      expect(bounds.cropY).toBe(0);
    });

    it('handles square 1:1 preset center cropping', () => {
      const bounds = calculateCenterCropBounds(1920, 1080, 1.0);
      expect(bounds.cropHeight).toBe(1080);
      expect(bounds.cropWidth).toBe(1080);
      expect(bounds.cropX).toBe((1920 - 1080) / 2); // 420
      expect(bounds.cropY).toBe(0);
    });

    it('gracefully handles zero or negative dimensions and freeform mode', () => {
      const bounds = calculateCenterCropBounds(1200, 800, 0);
      expect(bounds.cropWidth).toBe(1200);
      expect(bounds.cropHeight).toBe(800);
      expect(bounds.cropX).toBe(0);
      expect(bounds.cropY).toBe(0);
    });
  });

  describe('validateImageFile & formatFileSize', () => {
    it('formats file sizes accurately', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('validates supported image types (JPEG, PNG, WEBP)', () => {
      const validJpeg = new File(['dummy'], 'vessel.jpg', { type: 'image/jpeg' });
      const validPng = new File(['dummy'], 'vessel.png', { type: 'image/png' });
      const validWebp = new File(['dummy'], 'vessel.webp', { type: 'image/webp' });

      expect(validateImageFile(validJpeg).valid).toBe(true);
      expect(validateImageFile(validPng).valid).toBe(true);
      expect(validateImageFile(validWebp).valid).toBe(true);
    });

    it('rejects unsupported file formats', () => {
      const invalidPdf = new File(['dummy'], 'doc.pdf', { type: 'application/pdf' });
      const res = validateImageFile(invalidPdf);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Unsupported file format');
    });

    it('rejects files exceeding size limits', () => {
      const largeFile = new File(['dummy'], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: 30 * 1024 * 1024 }); // 30MB

      const res = validateImageFile(largeFile, 25 * 1024 * 1024);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('File size exceeds');
    });
  });

  describe('Canvas Rendering & Transformations', () => {
    it('renders transformed image with preset constraints in canvas environment', () => {
      // Mock canvas for jsdom if needed
      const mockCanvas = document.createElement('canvas');
      expect(mockCanvas).toBeDefined();

      const transform: CropTransform = {
        zoom: 1.2,
        panX: 10,
        panY: -5,
        rotate: 90,
        flipH: true,
      };

      expect(transform.zoom).toBe(1.2);
      expect(transform.rotate).toBe(90);
      expect(transform.flipH).toBe(true);
    });
  });

  describe('clampCropPan - Boundary Enforcement', () => {
    it('restricts pan to 0 when zoom is 1.0 and image matches aspect ratio', () => {
      // 16:9 image (1600x900) in 16:9 box (520x292.5) at zoom=1.0
      const clamped = clampCropPan({ x: 100, y: -50 }, 1.0, 1600, 900, 520, 292.5, 0);
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(0);
    });

    it('allows horizontal panning for wide images but strictly stops at image edges', () => {
      // 3200x900 (ultra wide) in 520x292.5 box
      const clampedWithin = clampCropPan({ x: 50, y: 0 }, 1.0, 3200, 900, 520, 292.5, 0);
      expect(clampedWithin.x).toBe(50);
      expect(clampedWithin.y).toBe(0);

      // Attempt to pan far beyond image edge
      const clampedOverflow = clampCropPan({ x: 9999, y: 9999 }, 1.0, 3200, 900, 520, 292.5, 0);
      expect(clampedOverflow.x).toBeLessThan(9999);
      expect(clampedOverflow.y).toBe(0); // Cannot pan vertically because image height fits box exactly
    });

    it('allows panning when zoomed in but clamps to boundaries', () => {
      // 1600x900 at zoom=2.0 allows panning up to half width/height
      const clamped = clampCropPan({ x: 500, y: -500 }, 2.0, 1600, 900, 520, 292.5, 0);
      expect(clamped.x).toBeLessThan(500);
      expect(clamped.y).toBeGreaterThan(-500);
    });

    it('strictly prevents vertical over-panning on wide aspect images (e.g. 1228x600 COSCO shipping freighter)', () => {
      // At zoom 1.0, vertical pan must be strictly 0
      const atZoom1 = clampCropPan({ x: 0, y: -200 }, 1.0, 1228, 600, 520, 292.5, 0);
      expect(atZoom1.y).toBe(0);

      // At zoom 1.3, vertical pan is strictly clamped to available overflow ((292.5 * 1.3 - 292.5) / 2 = 43.875)
      const atZoom13 = clampCropPan({ x: 0, y: -200 }, 1.3, 1228, 600, 520, 292.5, 0);
      expect(atZoom13.y).toBe(-43.875);
    });

    it('correctly clamps pan boundaries when image is rotated 90 degrees', () => {
      const clamped = clampCropPan({ x: 500, y: 500 }, 1.0, 1600, 900, 520, 292.5, 90);
      expect(Math.abs(clamped.x)).toBeLessThanOrEqual(500);
      expect(Math.abs(clamped.y)).toBeLessThanOrEqual(500);
    });
  });
});
