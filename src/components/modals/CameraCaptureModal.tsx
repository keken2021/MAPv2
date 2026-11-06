import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useCamera } from '../../utils/useCamera';
import { useOverlayBehavior } from '../../utils/useOverlayBehavior';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onUseCameraInput?: () => void;
  zIndex?: number;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onUseCameraInput,
  zIndex = 1060,
}) => {
  const { capturedPhotoDataUrl, videoRef, canvasRef, startStream, stopStream, takeCameraSnapshot, retake } = useCamera();
  const dialogRef = useRef<HTMLDivElement>(null);

  useOverlayBehavior(dialogRef, onClose, { active: isOpen });

  useEffect(() => {
    if (isOpen) {
      startStream();
    } else {
      stopStream();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUseCameraInput = () => {
    onClose();
    onUseCameraInput?.();
  };

  const handleAttach = () => {
    if (!capturedPhotoDataUrl) return;
    onCapture(capturedPhotoDataUrl);
  };

  return (
    <div
      className="map-modal-backdrop d-flex align-items-center justify-content-center p-3"
      style={{ zIndex }}
    >
      <div
        ref={dialogRef}
        className="map-camera-modal-dialog card p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Take Photo"
        tabIndex={-1}
      >
        <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-3">
          <h6 className="fw-bold text-dark m-0">Take Photo</h6>
          <button
            type="button"
            className="btn btn-sm btn-icon border-0 bg-transparent text-secondary p-1"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="d-flex flex-column align-items-center gap-3">
          {!capturedPhotoDataUrl ? (
            <>
              <video ref={videoRef} autoPlay playsInline className="map-camera-video-preview" />
              <canvas ref={canvasRef} className="d-none" />
              <div className="d-flex justify-content-center flex-wrap gap-2 w-100">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
                  Cancel
                </button>
                {onUseCameraInput && (
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleUseCameraInput}>
                    Use Camera
                  </button>
                )}
                <button type="button" className="btn btn-primary btn-sm px-4" onClick={takeCameraSnapshot}>
                  Take Photo
                </button>
              </div>
            </>
          ) : (
            <>
              <img src={capturedPhotoDataUrl} alt="Captured preview" className="map-camera-video-preview" />
              <div className="d-flex justify-content-center gap-2 w-100">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={retake}>
                  Retake
                </button>
                <button type="button" className="btn btn-success btn-sm px-4" onClick={handleAttach}>
                  Attach Photo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
