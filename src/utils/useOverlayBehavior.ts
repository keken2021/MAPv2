/*
  file summary: keyboard and focus behavior hook for one overlay layer (a drawer or a dialog opened on top of it).
  responsibilities: closes the top layer on escape, moves focus into the layer, keeps tab inside it, and returns focus to the opener.
  role in system: called by Drawer.tsx and by the dialogs a drawer opens on top of itself.
*/

import { RefObject, useEffect, useRef } from 'react';

interface OverlayBehaviorOptions {
  /* false while the layer is closed; the hook then does nothing */
  active?: boolean;
  /* true while a dialog that does not use this hook covers the layer, so escape and tab belong to that dialog */
  paused?: boolean;
  /* element that takes focus when the layer opens; the container itself when omitted */
  initialFocusRef?: RefObject<HTMLElement>;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* open layers in the order they opened; only the last one answers the keyboard */
const openLayers: symbol[] = [];

/**
  what: gives an open overlay layer its keyboard and focus behavior; inputs are the layer's container, its close handler and the options above.
  how: registers the layer on a shared stack while active, listens for escape and tab on the document, and acts only when the layer is the top one and not paused.
  with what file: src/utils/useOverlayBehavior.ts used by src/components/drawers/Drawer.tsx.
*/
export function useOverlayBehavior(
  containerRef: RefObject<HTMLElement>,
  onClose: () => void,
  { active = true, paused = false, initialFocusRef }: OverlayBehaviorOptions = {},
): void {
  /* the latest handler and pause flag, read at key time so a parent re-render does not restart the effect and steal focus */
  const onCloseRef = useRef(onClose);
  const pausedRef = useRef(paused);
  onCloseRef.current = onClose;
  pausedRef.current = paused;

  useEffect(() => {
    if (!active) return;

    const layerId = Symbol('overlay-layer');
    openLayers.push(layerId);
    const opener = document.activeElement as HTMLElement | null;
    (initialFocusRef?.current ?? containerRef.current)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (pausedRef.current || openLayers[openLayers.length - 1] !== layerId) return;

      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (!container.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const index = openLayers.indexOf(layerId);
      if (index !== -1) openLayers.splice(index, 1);
      if (opener && opener.isConnected) opener.focus();
    };
  }, [active, containerRef, initialFocusRef]);
}
