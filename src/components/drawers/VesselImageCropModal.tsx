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
} from '../../utils/imageCropHelpers';

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

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

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
          updateLivePreview(img, initialPreset, { zoom: 1.0, panX: 0, panY: 0, rotate: 0, flipH: false });
        })
        .catch(() => {
          // ignore load error in unmounted state
        });
    }
  }, [isOpen, imageSrc, initialPreset]);

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
          });
        }
      }, 80);
      return () => clearTimeout(handler);
    }
  }, [selectedPreset, zoom, pan, rotate, flipH, updateLivePreview]);

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + deltaX,
      y: dragStartRef.current.panY + deltaY,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
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
    const deltaX = e.touches[0].clientX - dragStartRef.current.x;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + deltaX,
      y: dragStartRef.current.panY + deltaY,
    });
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(Math.max(1.0, parseFloat((prev + delta).toFixed(2))), 3.5));
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

  // Rotate 90 deg clockwise
  const handleRotate = () => {
    setRotate((prev) => (prev + 90) % 360);
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
      className="modal fade show d-block"
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1100, backdropFilter: 'blur(4px)' }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden bg-white">
          {/* Header */}
          <div className="modal-header bg-slate-900 text-white px-4 py-3 border-0 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2.5">

              <div>
                <h5 className="modal-title fs-6 fw-bold mb-0 text-primary d-flex align-items-center gap-2">
                  Vessel Image Framing &amp; Sizing
                </h5>
                <span className="text-secondary small font-mono-code" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Target: {vesselName} · Original: {imgNaturalSize.width} × {imgNaturalSize.height} px
                </span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-xs btn-outline-light d-inline-flex align-items-center gap-1 py-1 px-2"
                onClick={handleSnapUniversal}
                title="Reset framing to Universal 16:9 standard"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
                <span>Universal 16:9 Fit</span>
              </button>
              <button
                type="button"
                className="btn btn-sm text-primary d-flex align-items-center justify-content-center rounded-circle border-0 p-1 hover-bg-secondary"
                style={{ width: '30px', height: '30px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                aria-label="Close"
                onClick={onClose}
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-4 bg-light">
            {/* Main Interactive Work Area */}
            <div className="row g-3">
              {/* Left Column: Interactive Viewport with Pan & Zoom */}
              <div className="col-lg-8">
                <div className="card border shadow-2xs rounded-3 overflow-hidden bg-white">
                  <div className="card-header bg-slate-900 text-primary py-2 px-3 d-flex align-items-center justify-content-between">
                    <span className="small fw-semibold d-flex align-items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="22" y1="12" x2="18" y2="12" />
                        <line x1="6" y1="12" x2="2" y2="12" />
                        <line x1="12" y1="6" x2="12" y2="2" />
                        <line x1="12" y1="22" x2="12" y2="18" />
                      </svg>
                      <span>Framing Viewport (Drag to pan · Scroll to zoom)</span>
                    </span>

                    <div className="d-flex align-items-center gap-1">
                      <button
                        type="button"
                        className={`btn btn-xs ${showGrid ? 'btn-light' : 'btn-outline-light'} py-0.5 px-2`}
                        onClick={() => setShowGrid(!showGrid)}
                        title="Toggle Rule-of-Thirds Grid"
                      >
                        Grid
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-light text-primary py-0.5 px-2"
                        onClick={handleRotate}
                        title="Rotate 90° Clockwise"
                      >
                        Rotate 90°
                      </button>
                      <button
                        type="button"
                        className={`btn btn-xs ${flipH ? 'btn-dark' : 'btn-outline-light'} text-primary py-0.5 px-2`}
                        onClick={handleFlipHorizontal}
                        title="Flip Horizontally"
                      >
                        Flip
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-light text-primary py-0.5 px-2"
                        onClick={handleReset}
                        title="Reset Pan and Zoom"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div
                    ref={containerRef}
                    className="position-relative overflow-hidden d-flex align-items-center justify-content-center select-none"
                    style={{
                      height: '380px',
                      backgroundColor: '#020617',
                      cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                      userSelect: 'none',
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onWheel={handleWheel}
                  >
                    {/* Darkened background layer */}
                    <div
                      className="position-absolute w-100 h-100 opacity-25"
                      style={{
                        backgroundImage: `url(${imageSrc})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        filter: 'blur(8px)',
                      }}
                    />

                    {/* Framing Box Area constrained by 16:9 aspect ratio */}
                    <div
                      className="position-relative border border-2 border-primary shadow-lg overflow-hidden d-flex align-items-center justify-content-center"
                      style={{
                        width: '90%',
                        maxWidth: '520px',
                        aspectRatio: '16/9',
                        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
                        backgroundColor: '#0f172a',
                      }}
                    >
                      {/* Transformed Image */}
                      {imageSrc && (
                        <img
                          src={imageSrc}
                          alt="Crop Target"
                          draggable={false}
                          className="position-absolute"
                          style={{
                            maxWidth: 'none',
                            maxHeight: 'none',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px) rotate(${rotate}deg) ${flipH ? 'scaleX(-1)' : ''}`,
                            transformOrigin: 'center center',
                            transition: isDraggingRef.current ? 'none' : 'transform 0.08s ease-out',
                            pointerEvents: 'none',
                          }}
                        />
                      )}

                      {/* Rule of Thirds Grid Overlay */}
                      {showGrid && (
                        <div className="position-absolute w-100 h-100 pointer-events-none" style={{ pointerEvents: 'none' }}>
                          <div className="w-100 h-100 position-relative">
                            <div className="position-absolute top-0 start-33 h-100 border-start border-white opacity-40" style={{ left: '33.33%' }} />
                            <div className="position-absolute top-0 start-66 h-100 border-start border-white opacity-40" style={{ left: '66.66%' }} />
                            <div className="position-absolute start-0 top-33 w-100 border-top border-white opacity-40" style={{ top: '33.33%' }} />
                            <div className="position-absolute start-0 top-66 w-100 border-top border-white opacity-40" style={{ top: '66.66%' }} />
                          </div>
                        </div>
                      )}

                      {/* Viewport Badge */}
                      <div
                        className="position-absolute bottom-0 end-0 m-2 px-2 py-0.5 rounded text-white font-mono-code fw-semibold pointer-events-none"
                        style={{ background: 'rgba(15, 23, 42, 0.85)', fontSize: '0.65rem' }}
                      >
                        16:9 · {zoom.toFixed(1)}x
                      </div>
                    </div>
                  </div>

                  {/* Bottom Zoom & Offset Controls */}
                  <div className="card-footer bg-white p-3 border-top d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '400px' }}>
                      <span className="small text-secondary fw-semibold" style={{ fontSize: '0.75rem' }}>Zoom:</span>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary px-2"
                        onClick={() => setZoom((prev) => Math.max(1.0, parseFloat((prev - 0.1).toFixed(2))))}
                      >
                        -
                      </button>
                      <input
                        type="range"
                        className="form-range flex-grow-1"
                        min="1"
                        max="3.5"
                        step="0.05"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                      />
                      <button
                        type="button"
                        className="btn btn-xs btn-outline-secondary px-2"
                        onClick={() => setZoom((prev) => Math.min(3.5, parseFloat((prev + 0.1).toFixed(2))))}
                      >
                        +
                      </button>
                      <span className="font-mono-code small text-dark fw-bold" style={{ minWidth: '42px' }}>
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
                    <div
                      className="position-relative rounded-2 overflow-hidden bg-dark border shadow-2xs"
                      style={{ height: '140px' }}
                    >
                      {livePreviewUrl ? (
                        <img src={livePreviewUrl} alt="Cover preview" className="w-100 h-100" style={{ objectFit: 'cover' }} />
                      ) : (
                        <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted small">
                          Rendering...
                        </div>
                      )}
                      <div
                        className="position-absolute bottom-0 start-0 w-100 px-2 py-0.5 text-white d-flex align-items-center justify-content-between"
                        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', fontSize: '0.65rem' }}
                      >
                        <span className="fw-bold text-truncate">{vesselName}</span>
                        <span className="badge bg-primary text-white p-0.5 px-1 font-mono-code" style={{ fontSize: '0.55rem' }}>
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
          <div className="modal-footer bg-light border-top d-flex align-items-center justify-content-between px-4 py-3">
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
