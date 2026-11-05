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
import { Modal } from './Modal';
import './VesselImageCropModal.css';

export interface VesselImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  vesselName?: string;
  assetName?: string;
  title?: string;
  initialPreset?: string;
  zIndex?: number;
  onSave: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const VesselImageCropModal: React.FC<VesselImageCropModalProps> = ({
  isOpen,
  imageSrc,
  vesselName,
  assetName,
  title,
  initialPreset = '16:9',
  zIndex,
  onSave,
  onClose,
}) => {
  const displayTitle = title || 'Image Framing & Sizing';
  const displaySubtitle = assetName || vesselName || 'Asset Profile';
  const isSquare = initialPreset === '1:1';
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotate, setRotate] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isInteracting, setIsInteracting] = useState<boolean>(false);

  const [containerBoxSize, setContainerBoxSize] = useState<{ width: number; height: number }>(
    isSquare ? { width: 450, height: 450 } : { width: 800, height: 450 }
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  const loadedImageRef = useRef<HTMLImageElement | null>(null);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notifyMovement = useCallback(() => {
    setIsInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 450);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth || (isSquare ? 450 : 800);
        const h = isSquare ? w : (w * 9) / 16;
        setContainerBoxSize({ width: w, height: h });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) {
      ro.observe(containerRef.current);
    }
    return () => ro.disconnect();
  }, [isOpen, isSquare]);

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
        .catch(() => {});
    }
  }, [isOpen, imageSrc, containerBoxSize.width, containerBoxSize.height]);

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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    handleZoomChange(zoom + delta);
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setRotate(0);
    setFlipH(false);
  };

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

  const handleFlipHorizontal = () => {
    setFlipH((prev) => !prev);
  };

  const handleApply = async () => {
    if (!loadedImageRef.current) return;
    setIsProcessing(true);
    try {
      const croppedUrl = renderCroppedImageToDataUrl(
        loadedImageRef.current,
        (initialPreset as import('../../utils/imageCropHelpers').VesselImageCropPreset) || '16:9',
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
      console.error('Failed to crop and save image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={displayTitle}
      meta={displaySubtitle}
      size="lg"
      dismissible={false}
      bodyClassName="p-3"
      zIndex={zIndex}
      footer={
        <>
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
            data-testid="crop-save"
          >
            {isProcessing ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>
        </>
      }
    >
      <div className="card border shadow-2xs rounded-3 overflow-hidden bg-white w-100">
        {/* Viewport Stage Container */}
        <div className="crop-stage-container w-100 p-0 bg-dark overflow-hidden d-flex justify-content-center">
          <div
            ref={containerRef}
            className="crop-viewport position-relative overflow-hidden w-100"
            style={{
              aspectRatio: isSquare ? '1 / 1' : '16 / 9',
              maxWidth: isSquare ? '420px' : '100%',
              cursor: isDraggingRef.current ? 'grabbing' : 'grab',
              margin: '0 auto',
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
            {imageSrc && (() => {
              const boxW = containerBoxSize.width || (isSquare ? 420 : 800);
              const boxH = containerBoxSize.height || (isSquare ? boxW : (boxW * 9) / 16);
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

            {showGrid && (
              <div className={`crop-grid-overlay ${isInteracting ? 'is-active' : ''}`}>
                <div className="w-100 h-100 position-relative">
                  <div className="crop-grid-line-v1" />
                  <div className="crop-grid-line-v2" />
                  <div className="crop-grid-line-h1" />
                  <div className="crop-grid-line-h2" />
                </div>
              </div>
            )}

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
                  {initialPreset} · {zoom.toFixed(1)}x
                </span>
              </div>
            </div>

            <div
              className={`crop-corner-controls position-absolute bottom-0 end-0 m-2.5 d-flex align-items-center gap-1.5 z-3 ${isInteracting ? 'is-faded' : ''
                }`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`crop-insta-btn ${showGrid ? 'active' : ''}`}
                onClick={() => setShowGrid(!showGrid)}
                title={showGrid ? 'Hide 3x3 Grid' : 'Show 3x3 Grid'}
              >
                <Grid3x3 size={15} strokeWidth={2} />
              </button>

              <button
                type="button"
                className="crop-insta-btn"
                onClick={handleRotate}
                title="Rotate"
              >
                <RotateCw size={15} strokeWidth={2} />
              </button>

              <button
                type="button"
                className={`crop-insta-btn ${flipH ? 'active' : ''}`}
                onClick={handleFlipHorizontal}
                title="Flip"
              >
                <FlipHorizontal size={15} strokeWidth={2} />
              </button>

              <button
                type="button"
                className="crop-insta-btn"
                onClick={handleReset}
                title="Reset"
              >
                <RefreshCw size={15} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* Zoom Bar */}
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
    </Modal>
  );
};

export { VesselImageCropModal as AssetImageCropModal };
export { VesselImageCropModal as ImageCropModal };
