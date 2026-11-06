import { useRef, useState } from 'react';

export interface UseCameraReturn {
  cameraStream: MediaStream | null;
  capturedPhotoDataUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  startStream: () => Promise<void>;
  stopStream: () => void;
  takeCameraSnapshot: () => void;
  retake: () => void;
}

export function useCamera(): UseCameraReturn {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhotoDataUrl, setCapturedPhotoDataUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startStream = async () => {
    setCapturedPhotoDataUrl(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      /* stream unavailable — video element stays blank */
    }
  };

  const stopStream = () => {
    setCameraStream((prev) => {
      if (prev) prev.getTracks().forEach((t) => t.stop());
      return null;
    });
    if (videoRef.current) videoRef.current.srcObject = null;
    setCapturedPhotoDataUrl(null);
  };

  const takeCameraSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.85));
  };

  const retake = () => setCapturedPhotoDataUrl(null);

  return { cameraStream, capturedPhotoDataUrl, videoRef, canvasRef, startStream, stopStream, takeCameraSnapshot, retake };
}
