/*
  file summary: shared drawer shell, a panel that slides in from the right edge over a backdrop.
  responsibilities: renders the backdrop, header (title, meta line, right slot, close button), scrolling body and optional fixed footer; closes on escape and on a backdrop click.
  role in system: wraps the content of every drawer in src/components/drawers; styles are .map-drawer in src/App.css.
*/

import React, { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useOverlayBehavior } from '../../utils/useOverlayBehavior';

export type DrawerSize = 'sm' | 'lg' | 'xl';

interface DrawerProps {
  title: React.ReactNode;
  /* one line under the title: an ID, a file name, a location */
  meta?: React.ReactNode;
  /* content at the right of the header, before the close button */
  headerAside?: React.ReactNode;
  /* sm 520px for lists and logs, lg 880px for one record, xl 1240px for a two-column review */
  size?: DrawerSize;
  onClose: () => void;
  /* fixed action bar: close or cancel on the left, the primary action on the right */
  footer?: React.ReactNode;
  /* true while a modal opened from this drawer covers it */
  paused?: boolean;
  children: React.ReactNode;
}

/**
  what: renders one drawer; inputs are the header content, the size, the close handler, an optional footer and the body.
  how: portals to the document body so the page behind cannot scroll or clip it, and hands escape, focus and tab handling to useOverlayBehavior.
  with what file: src/components/drawers/Drawer.tsx used by the drawers in the same folder.
*/
export const Drawer: React.FC<DrawerProps> = ({
  title,
  meta,
  headerAside,
  size = 'sm',
  onClose,
  footer,
  paused = false,
  children,
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useOverlayBehavior(panelRef, onClose, { paused, initialFocusRef: closeButtonRef });

  return createPortal(
    <>
      <div className="map-drawer-backdrop" onClick={onClose} data-testid="drawer-backdrop" />
      <div
        ref={panelRef}
        className={`map-drawer map-drawer-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="map-drawer-header">
          <div className="map-drawer-heading">
            <h2 id={titleId} className="map-drawer-title">
              {title}
            </h2>
            {meta && <div className="map-drawer-meta">{meta}</div>}
          </div>
          <div className="map-drawer-aside">
            {headerAside}
            <button
              ref={closeButtonRef}
              type="button"
              className="map-drawer-close"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="map-drawer-body">{children}</div>

        {footer && <div className="map-drawer-footer">{footer}</div>}
      </div>
    </>,
    document.body,
  );
};
