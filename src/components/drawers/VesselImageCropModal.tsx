/* 
  file summary: interactive vessel image cropping and framing modal.
  responsibilities: provides a 100% width Instagram-grade image cropper strictly matching the 16:9 image container/gallery of the vessel detail page with smooth grab-panning, boundary clamping, zoom, 3x3 rule-of-thirds grid, rotation, flip, and pixel-perfect high-DPI canvas output.
  role in system: consumed by VesselModal and VesselDetailView photo management flows.
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CropTransform,
  renderCroppedImageToDataUrl,
  loadImageElement,
  clampCropPan,
  getBaseImageDisplaySize,
} from '../../utils/imageCropHelpers';
import {
  Grid3x3,
  RotateCw,
  FlipHorizontal,
  RefreshCw,
  X,
  Minus,
  Plus,
  ZoomIn,
} from 'lucide-react';
import './VesselImageCropModal.css';

export interface VesselImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  vesselName?: string;
  initialPreset?: string;
  onSave: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const VesselImageCropModal: React.FC<VesselImageCropModalProps> = ({
  isOpen,
  imageSrc,
  vesselName = 'Vessel Profile',
  onSave,
  onClose,
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotate, setRotate] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  const [containerBoxSize, setContainerBoxSize] = useState<{ width: number; height: number }>({ width: 800, height: 450 });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to trigger interaction state that auto-hides toolbars during pan/movement
  const notifyMovement = useCallback(() => {
    setIsInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 450);
  }, []);

  // Measure and track container width/height dynamically based on exact 16:9 aspect ratio
  useEffect(() => {
    if (!isOpen) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || 800;
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
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      setRotate(0);
      setFlipH(false);
      setShowGrid(true);

      loadImageElement(imageSrc)
        .then((img) => {
          loadedImageRef.current = img;
          setImgNaturalSize({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        })
        .catch(() => {
          // ignore load error in unmounted state
        });
    }
  }, [isOpen, imageSrc, containerBoxSize.width, containerBoxSize.height]);

  // Zoom handler with boundary re-clamping based on container dimensions
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

  // Apply and export cropped image matching 16:9 vessel container
  const handleApply = async () => {
    if (!loadedImageRef.current) return;
    setIsProcessing(true);
    try {
      const croppedUrl = renderCroppedImageToDataUrl(
        loadedImageRef.current,
        '16:9',
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

  return (
    <div
      className="modal fade show d-block crop-modal-backdrop"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden crop-modal-content">
          {/* Header */}
          <div className="modal-header crop-modal-header px-4 py-3 border-0 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2.5">
              <div>
                <h5 className="modal-title fs-6 fw-bold mb-0 crop-modal-title d-flex align-items-center gap-2">
                  Vessel Image Framing &amp; Sizing
                </h5>
                <span className="crop-modal-subtitle font-mono-code">
                  {vesselName}
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

          {/* Body: 100% Width Framing View */}
          <div className="modal-body p-3 crop-modal-body">
            <div className="card border shadow-2xs rounded-3 overflow-hidden bg-white w-100">
              {/* Viewport Stage Container (Flush with 0 padding) */}
              <div className="crop-stage-container w-100 p-0 bg-dark overflow-hidden">
                <div
                  ref={containerRef}
                  className="crop-viewport position-relative overflow-hidden w-100"
                  style={{
                    aspectRatio: '16 / 9',
                    cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                    width: '100%',
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
                  {/* Transformed Image covering 100% of the 16:9 viewport */}
                  {imageSrc && (() => {
                    const boxW = containerBoxSize.width || 800;
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
                          transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${finalScale}) rotate(${rotate}deg) ${flipH ? 'scaleX(-1)' : ''
                            }`,
                          transition: isDraggingRef.current ? 'none' : 'transform 0.08s ease-out',
                        }}
                      />
                    );
                  })()}

                  {/* Instagram-style 3x3 Rule-of-Thirds Grid Overlay */}
                  {showGrid && (
                    <div
                      className={`crop-grid-overlay ${isInteracting ? 'is-active' : ''}`}
                    >
                      <div className="w-100 h-100 position-relative">
                        <div className="crop-grid-line-v1" />
                        <div className="crop-grid-line-v2" />
                        <div className="crop-grid-line-h1" />
                        <div className="crop-grid-line-h2" />
                      </div>
                    </div>
                  )}

                  {/* Bottom-Left Instagram Floating Tools (Zoom indicator) */}
                  <div
                    className={`crop-corner-controls position-absolute bottom-0 start-0 m-2.5 d-flex align-items-center gap-1.5 z-3 ${isInteracting ? 'is-faded' : ''
                      }`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <div className="crop-insta-btn">
                      <ZoomIn size={14} strokeWidth={2} />
                      <span className="font-mono-code fw-bold ms-1" style={{ fontSize: '0.68rem' }}>
                        16:9 · {zoom.toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  {/* Bottom-Right Instagram Floating Tools (Rotate, Flip, Reset, Grid) */}
                  <div
                    className={`crop-corner-controls position-absolute bottom-0 end-0 m-2.5 d-flex align-items-center gap-1.5 z-3 ${isInteracting ? 'is-faded' : ''
                      }`}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    {/* Grid Toggle Button */}
                    <button
                      type="button"
                      className={`crop-insta-btn ${showGrid ? 'active' : ''}`}
                      onClick={() => setShowGrid(!showGrid)}
                      title={showGrid ? 'Hide 3x3 Grid' : 'Show 3x3 Grid'}
                    >
                      <Grid3x3 size={15} strokeWidth={2} />
                    </button>

                    {/* Rotate 90 deg Clockwise Button */}
                    <button
                      type="button"
                      className="crop-insta-btn"
                      onClick={handleRotate}
                      title="Rotate 90° Clockwise"
                    >
                      <RotateCw size={15} strokeWidth={2} />
                    </button>

                    {/* Flip Horizontal Button */}
                    <button
                      type="button"
                      className={`crop-insta-btn ${flipH ? 'active' : ''}`}
                      onClick={handleFlipHorizontal}
                      title="Flip Horizontally"
                    >
                      <FlipHorizontal size={15} strokeWidth={2} />
                    </button>

                    {/* Reset Button */}
                    <button
                      type="button"
                      className="crop-insta-btn"
                      onClick={handleReset}
                      title="Reset Pan and Zoom"
                    >
                      <RefreshCw size={15} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Footer Zoom Bar taking 100% width */}
              <div className="card-footer bg-white p-3 border-top w-100">
                <div className="d-flex align-items-center gap-3 w-100 crop-zoom-container">
                  <span className="crop-zoom-label fw-semibold text-nowrap">Zoom:</span>
                  <button
                    type="button"
                    className="w-7 h-7 rounded border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
                    onClick={() => handleZoomChange(zoom - 0.1)}
                    title="Zoom out"
                  >
                    <Minus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                  <input
                    type="range"
                    className="form-range flex-grow-1 w-100"
                    min="1"
                    max="3.5"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                  />
                  <button
                    type="button"
                    className="w-7 h-7 rounded border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
                    onClick={() => handleZoomChange(zoom + 0.1)}
                    title="Zoom in"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                  <span className="crop-zoom-value font-mono-code small fw-bold text-nowrap">
                    {zoom.toFixed(2)}x
                  </span>
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
