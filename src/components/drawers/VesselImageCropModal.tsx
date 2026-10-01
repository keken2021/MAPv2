/* 
  file summary: interactive universal vessel image cropping, aspect framing and sizing modal.
  responsibilities: allows users to preview, zoom, pan, rotate, flip, and crop uploaded vessel photos to universal maritime standards (16:9 universal standard, 4:3, 3:2, 1:1, or freeform).
  role in system: consumed by VesselModal and VesselDetailView photo management flows.
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  VesselImageCropPreset,
  UNIVERSAL_VESSEL_PRESETS,
  DEFAULT_UNIVERSAL_PRESET,
  CropTransform,
  renderCroppedImageToDataUrl,
  loadImageElement,
  clampCropPan,
  getBaseImageDisplaySize,
} from '../../utils/imageCropHelpers';
import { Grid3x3, RotateCw, FlipHorizontal, RefreshCw, X, Minus, Plus } from 'lucide-react';
import './VesselImageCropModal.css';

export interface VesselImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  vesselName?: string;
  initialPreset?: VesselImageCropPreset;
  onSave: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const VesselImageCropModal: React.FC<VesselImageCropModalProps> = ({
  isOpen,
  imageSrc,
  vesselName = 'Vessel Profile',
  initialPreset = DEFAULT_UNIVERSAL_PRESET,
  onSave,
  onClose,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<VesselImageCropPreset>(initialPreset);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotate, setRotate] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string>('');
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  const [containerBoxSize, setContainerBoxSize] = useState<{ width: number; height: number }>({ width: 640, height: 360 });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to trigger interaction state that auto-hides the left icon bar during movement
  const notifyMovement = useCallback(() => {
    setIsInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 450);
  }, []);

  // Measure and track container width/height dynamically
  useEffect(() => {
    if (!isOpen) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || 640;
        const h = containerRef.current.clientHeight || (w * 9) / 16;
        setContainerBoxSize({ width: w, height: h });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    return () => ro.disconnect();
  }, [isOpen]);

  // Reset or initialize state when opening or when image changes
  useEffect(() => {
    if (isOpen && imageSrc) {
      setSelectedPreset(initialPreset);
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      setRotate(0);
      setFlipH(false);
      setShowGrid(true);

      loadImageElement(imageSrc)
        .then((img) => {
          loadedImageRef.current = img;
          setImgNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
          updateLivePreview(img, initialPreset, {
            zoom: 1.0,
            panX: 0,
            panY: 0,
            rotate: 0,
            flipH: false,
            boxWidth: containerBoxSize.width,
            boxHeight: containerBoxSize.height,
          });
        })
        .catch(() => {
          // ignore load error in unmounted state
        });
    }
  }, [isOpen, imageSrc, initialPreset, containerBoxSize.width, containerBoxSize.height]);

  // Update live preview whenever transform or preset changes
  const updateLivePreview = useCallback(
    (img: HTMLImageElement | null, preset: VesselImageCropPreset, transform: CropTransform) => {
      if (!img) return;
      try {
        const previewUrl = renderCroppedImageToDataUrl(img, preset, transform, 0.85);
        setLivePreviewUrl(previewUrl);
      } catch {
        // ignore preview render failure
      }
    },
    [],
  );

  // Debounced live preview update
  useEffect(() => {
    if (loadedImageRef.current) {
      const handler = setTimeout(() => {
        if (loadedImageRef.current) {
          updateLivePreview(loadedImageRef.current, selectedPreset, {
            zoom,
            panX: pan.x,
            panY: pan.y,
            rotate,
            flipH,
            boxWidth: containerBoxSize.width,
            boxHeight: containerBoxSize.height,
          });
        }
      }, 80);
      return () => clearTimeout(handler);
    }
  }, [selectedPreset, zoom, pan, rotate, flipH, containerBoxSize.width, containerBoxSize.height, updateLivePreview]);

  // Zoom handler with boundary re-clamping based on 100% container dimensions
  const handleZoomChange = (newZoom: number) => {
    notifyMovement();
    const clampedZoom = Math.min(3.5, Math.max(1.0, parseFloat(newZoom.toFixed(2))));
    setZoom(clampedZoom);
    setPan((prevPan) =>
      clampCropPan(
        prevPan,
        clampedZoom,
        imgNaturalSize.width,
        imgNaturalSize.height,
        containerBoxSize.width,
        containerBoxSize.height,
        rotate,
      ),
    );
  };

  // Mouse drag handlers for panning with strict image boundary clamping and movement auto-hide
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    setIsInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const rawPan = {
      x: dragStartRef.current.panX + deltaX,
      y: dragStartRef.current.panY + deltaY,
    };
    const clamped = clampCropPan(
      rawPan,
      zoom,
      imgNaturalSize.width,
      imgNaturalSize.height,
      containerBoxSize.width,
      containerBoxSize.height,
      rotate,
    );
    setPan(clamped);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 250);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      setIsInteracting(true);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || e.touches.length !== 1) return;
    setIsInteracting(true);
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    const rawPan = {
      x: dragStartRef.current.panX + deltaX,
      y: dragStartRef.current.panY + deltaY,
    };
    const clamped = clampCropPan(
      rawPan,
      zoom,
      imgNaturalSize.width,
      imgNaturalSize.height,
      containerBoxSize.width,
      containerBoxSize.height,
      rotate,
    );
    setPan(clamped);
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 250);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoomChange(zoom + delta);
  };

  // Quick reset to center fit
  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setRotate(0);
    setFlipH(false);
  };

  // Quick universal snap (16:9 Universal Standard)
  const handleSnapUniversal = () => {
    setSelectedPreset('16:9');
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setRotate(0);
    setFlipH(false);
  };

  // Rotate 90 deg clockwise with boundary re-clamping
  const handleRotate = () => {
    const nextRotate = (rotate + 90) % 360;
    setRotate(nextRotate);
    setPan((prevPan) =>
      clampCropPan(
        prevPan,
        zoom,
        imgNaturalSize.width,
        imgNaturalSize.height,
        containerBoxSize.width,
        containerBoxSize.height,
        nextRotate,
      ),
    );
  };

  // Flip horizontal
  const handleFlipHorizontal = () => {
    setFlipH((prev) => !prev);
  };

  // Apply and export cropped image
  const handleApply = async () => {
    if (!loadedImageRef.current) return;
    setIsProcessing(true);
    try {
      const croppedUrl = renderCroppedImageToDataUrl(
        loadedImageRef.current,
        selectedPreset,
        {
          zoom,
          panX: pan.x,
          panY: pan.y,
          rotate,
          flipH,
          boxWidth: containerBoxSize.width,
          boxHeight: containerBoxSize.height,
        },
        0.92,
        'image/jpeg',
      );
      onSave(croppedUrl);
      onClose();
    } catch (err) {
      console.error('Failed to crop and save vessel image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const activePresetInfo = UNIVERSAL_VESSEL_PRESETS[selectedPreset] || UNIVERSAL_VESSEL_PRESETS['16:9'];
  const aspectStyleRatio = activePresetInfo.aspectRatio > 0 ? `${activePresetInfo.aspectRatio}` : '16/9';

  return (
    <div
      className="modal fade show d-block crop-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden crop-modal-content">
          {/* Header */}
          <div className="modal-header crop-modal-header px-4 py-3 border-0 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2.5">
              <div>
                <h5 className="modal-title fs-6 fw-bold mb-0 crop-modal-title d-flex align-items-center gap-2">
                  Vessel Image Framing &amp; Sizing
                </h5>
                <span className="crop-modal-subtitle font-mono-code">
                  Target: {vesselName} · Original: {imgNaturalSize.width} × {imgNaturalSize.height} px
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center">
              <button
                type="button"
                className="crop-modal-close-btn rounded-circle"
                aria-label="Close"
                onClick={onClose}
                title="Close"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-4 crop-modal-body">
            {/* Main Interactive Work Area */}
            <div className="row g-3">
              {/* Left Column: Interactive Viewport with Pan & Zoom */}
              <div className="col-lg-8">
                <div className="card border shadow-2xs rounded-3 overflow-hidden bg-white">
                  <div className="card-header crop-viewport-card-header py-2 px-3 d-flex align-items-center justify-content-between">
                    <span className="small fw-semibold d-flex align-items-center gap-1.5 crop-viewport-title">
                      <span>Framing Viewport</span>
                    </span>
                  </div>

                  <div
                    ref={containerRef}
                    className="crop-viewport position-relative overflow-hidden w-100"
                    style={{
                      cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                    onDragStart={(e) => e.preventDefault()}
                  >
                    {/* Floating Action Icon Bar on Left (Auto-hides on drag/movement) */}
                    <div
                      className={`crop-floating-toolbar position-absolute top-50 start-0 ms-2.5 d-flex flex-column gap-1.5 p-1 rounded-3 z-3 shadow-lg ${
                        isInteracting ? 'is-hidden' : ''
                      }`}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      {/* 1. Grid Toggle Button */}
                      <button
                        type="button"
                        className={`crop-tool-btn ${showGrid ? 'active' : ''}`}
                        onClick={() => setShowGrid(!showGrid)}
                        title={showGrid ? 'Hide Rule-of-Thirds Grid' : 'Show Rule-of-Thirds Grid'}
                      >
                        <Grid3x3 size={15} strokeWidth={2} />
                      </button>

                      {/* 2. Rotate 90 deg Clockwise Button */}
                      <button
                        type="button"
                        className="crop-tool-btn"
                        onClick={handleRotate}
                        title="Rotate 90° Clockwise"
                      >
                        <RotateCw size={15} strokeWidth={2} />
                      </button>

                      {/* 3. Flip Horizontal Button */}
                      <button
                        type="button"
                        className={`crop-tool-btn ${flipH ? 'active' : ''}`}
                        onClick={handleFlipHorizontal}
                        title="Flip Horizontally"
                      >
                        <FlipHorizontal size={15} strokeWidth={2} />
                      </button>

                      {/* 4. Reset Button */}
                      <button
                        type="button"
                        className="crop-tool-btn"
                        onClick={handleReset}
                        title="Reset Pan and Zoom"
                      >
                        <RefreshCw size={15} strokeWidth={2} />
                      </button>
                    </div>

                    {/* Transformed Image taking 100% of the viewport container */}
                    {imageSrc && (() => {
                      const boxW = containerBoxSize.width || 640;
                      const boxH = containerBoxSize.height || (boxW * 9) / 16;
                      const baseSize = getBaseImageDisplaySize(
                        imgNaturalSize.width,
                        imgNaturalSize.height,
                        boxW,
                        boxH,
                      );
                      const isRotated90or270 = Math.abs(rotate) % 180 !== 0;
                      const rotScale = isRotated90or270
                        ? Math.max(boxW / baseSize.height, boxH / baseSize.width)
                        : 1.0;
                      const finalScale = zoom * rotScale;

                      return (
                        <img
                          src={imageSrc}
                          alt="Crop Target"
                          draggable={false}
                          className="crop-target-img"
                          style={{
                            width: `${baseSize.width}px`,
                            height: `${baseSize.height}px`,
                            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${finalScale}) rotate(${rotate}deg) ${flipH ? 'scaleX(-1)' : ''}`,
                            transition: isDraggingRef.current ? 'none' : 'transform 0.08s ease-out',
                          }}
                        />
                      );
                    })()}

                    {/* Rule of Thirds Grid Overlay covering 100% of the viewport */}
                    {showGrid && (
                      <div className="crop-grid-overlay">
                        <div className="w-100 h-100 position-relative">
                          <div className="crop-grid-line-v1" />
                          <div className="crop-grid-line-v2" />
                          <div className="crop-grid-line-h1" />
                          <div className="crop-grid-line-h2" />
                        </div>
                      </div>
                    )}

                    {/* Viewport Badge */}
                    <div className="crop-viewport-badge position-absolute bottom-0 end-0 m-2 px-2 py-0.5 rounded font-mono-code fw-semibold">
                      16:9 · {zoom.toFixed(1)}x
                    </div>
                  </div>

                  {/* Bottom Zoom & Offset Controls */}
                  <div className="card-footer bg-white p-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-2 flex-grow-1 crop-zoom-container">
                      <span className="crop-zoom-label fw-semibold">Zoom:</span>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary px-2 d-flex align-items-center justify-content-center"
                        style={{ width: '26px', height: '26px' }}
                        onClick={() => handleZoomChange(zoom - 0.1)}
                        title="Zoom out"
                      >
                        <Minus size={12} strokeWidth={2.5} />
                      </button>
                      <input
                        type="range"
                        className="form-range flex-grow-1"
                        min="1"
                        max="3.5"
                        step="0.05"
                        value={zoom}
                        onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                      />
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary px-2 d-flex align-items-center justify-content-center"
                        style={{ width: '26px', height: '26px' }}
                        onClick={() => handleZoomChange(zoom + 0.1)}
                        title="Zoom in"
                      >
                        <Plus size={12} strokeWidth={2.5} />
                      </button>
                      <span className="crop-zoom-value font-mono-code small fw-bold">
                        {zoom.toFixed(2)}x
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Output Preview */}
              <div className="col-lg-4 d-flex flex-column gap-3">
                <div className="card border shadow-2xs rounded-3 bg-white p-3">
                  <div className="fw-bold text-dark small mb-2">
                    <span>Live Preview</span>
                  </div>

                  {/* Live Hero Banner Preview */}
                  <div>
                    <div className="crop-preview-frame shadow-2xs w-100 position-relative">
                      {livePreviewUrl ? (
                        <img src={livePreviewUrl} alt="Cover preview" className="w-100 h-100" style={{ objectFit: 'cover' }} />
                      ) : (
                        <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted small">
                          Rendering...
                        </div>
                      )}
                      <div className="crop-preview-overlay d-flex align-items-center justify-content-between">
                        <span className="fw-bold text-truncate">{vesselName}</span>
                        <span className="badge crop-cover-badge p-0.5 px-1 font-mono-code">
                          COVER
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer crop-modal-footer d-flex align-items-center justify-content-between px-4 py-3">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary px-3"
              onClick={onClose}
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5 px-3 fw-semibold shadow-sm"
              onClick={handleApply}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Apply &amp; Save Sized Photo</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
