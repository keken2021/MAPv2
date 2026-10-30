/*
  file summary: header navigation helper, hook, and back button component for top layout header banner.
  responsibilities: computes contextual back navigation target and label across screens, preserves originating entity (e.g. Assurance Set from CAPA open findings), and falls back to parent list view.
  role in system: used by HeaderBanner and header components across views.
*/

import React, { useMemo, useCallback } from 'react';
import { useMapStore } from '../store/useMapStore';

export const detailSection = (view: string): { label: string; listView: string } => {
  switch (view) {
    case 'vessels':
      return { label: 'Vessels', listView: 'vessels' };
    case 'equipment':
      return { label: 'Equipment', listView: 'equipment' };
    case 'project':
      return { label: 'Projects', listView: 'project' };
    case 'documents':
      return { label: 'Document Library', listView: 'documents' };
    case 'crew':
      return { label: 'Crew Directory', listView: 'crew' };
    case 'inspection':
    case 'inspector':
      return { label: 'Inspections', listView: 'inspector' };
    case 'capa':
    case 'capas':
      return { label: 'CAPA', listView: 'capa' };
    case 'approver':
      return { label: 'Approvals', listView: 'approver' };
    case 'create-assurance-set':
    case 'assurance-sets':
    default:
      return { label: 'Assurance Sets', listView: 'assurance-sets' };
  }
};

export interface HeaderBackNavigationInfo {
  isDetailPage: boolean;
  label: string;
  targetView: string;
  targetEntityId?: string;
}

/**
  what: computes the back navigation target, label, and detail page status for the top header banner.
  how: checks whether a referring entity exists across screens (e.g. navigating from an assurance set to CAPA findings)
       and preserves return to that entity, falling back to the parent list view without ever displaying 'Back to Dashboard'.
  with what file: src/utils/headerNavigation.tsx consumed by useHeaderBackNavigation and HeaderBanner.
*/
export function getHeaderBackNavigation(
  currentHashView: string,
  currentEntityId?: string,
  previousHashView?: string,
  previousEntityId?: string,
): HeaderBackNavigationInfo {
  const currentSection = detailSection(currentHashView);

  const hasReferringEntity = Boolean(
    previousEntityId &&
      previousHashView &&
      previousHashView !== 'dashboard' &&
      previousHashView !== currentHashView
  );

  const isDetailPage =
    Boolean(currentEntityId) ||
    hasReferringEntity ||
    currentHashView === 'create-assurance-set' ||
    (currentHashView === 'project' && currentEntityId === 'new');

  // If there is a referring entity from another screen, return to it contextually
  if (hasReferringEntity && previousHashView && previousEntityId) {
    switch (previousHashView) {
      case 'assurance-sets':
        return {
          isDetailPage: true,
          label: 'Back to Assurance Set',
          targetView: 'assurance-sets',
          targetEntityId: previousEntityId,
        };
      case 'vessels':
        return {
          isDetailPage: true,
          label: 'Back to Vessel Detail',
          targetView: 'vessels',
          targetEntityId: previousEntityId,
        };
      case 'project':
        return {
          isDetailPage: true,
          label: previousEntityId === 'new' ? 'Back to Projects' : 'Back to Project Detail',
          targetView: 'project',
          targetEntityId: previousEntityId === 'new' ? undefined : previousEntityId,
        };
      case 'documents':
        return {
          isDetailPage: true,
          label: 'Back to Document Detail',
          targetView: 'documents',
          targetEntityId: previousEntityId,
        };
      case 'crew':
        return {
          isDetailPage: true,
          label: 'Back to Crew Detail',
          targetView: 'crew',
          targetEntityId: previousEntityId,
        };
      case 'equipment':
        return {
          isDetailPage: true,
          label: 'Back to Equipment Detail',
          targetView: 'equipment',
          targetEntityId: previousEntityId,
        };
      case 'inspection':
      case 'inspector':
        return {
          isDetailPage: true,
          label: 'Back to Inspection Checklist',
          targetView: 'inspector',
          targetEntityId: previousEntityId,
        };
      case 'approver':
        return {
          isDetailPage: true,
          label: 'Back to Approval Detail',
          targetView: 'approver',
          targetEntityId: previousEntityId,
        };
      case 'capa':
      case 'capas':
        return {
          isDetailPage: true,
          label: 'Back to CAPA',
          targetView: 'capa',
          targetEntityId: previousEntityId,
        };
      default:
        break;
    }
  }

  // Cross-screen views without a specific entity (e.g. notifications, marketplace)
  if (previousHashView && previousHashView !== 'dashboard' && previousHashView !== currentHashView) {
    if (previousHashView === 'notifications') {
      return {
        isDetailPage: true,
        label: 'Back to Notifications',
        targetView: 'notifications',
        targetEntityId: undefined,
      };
    }
    if (previousHashView === 'marketplace') {
      return {
        isDetailPage: true,
        label: 'Back to Marketplace',
        targetView: 'marketplace',
        targetEntityId: undefined,
      };
    }
  }

  // Default: return to parent list of the current section
  return {
    isDetailPage,
    label: `Back to ${currentSection.label}`,
    targetView: currentSection.listView,
    targetEntityId: undefined,
  };
}

export interface HeaderBackNavigationHookResult extends HeaderBackNavigationInfo {
  handleBack: () => void;
}

/**
  what: react hook providing header back button state and action.
  how: reads view and entity state from useMapStore and provides memoized navigation info and click handler.
  with what file: src/utils/headerNavigation.tsx consumed by HeaderBanner and HeaderBackButton.
*/
export function useHeaderBackNavigation(): HeaderBackNavigationHookResult {
  const currentHashView = useMapStore((s) => s.currentHashView);
  const currentEntityId = useMapStore((s) => s.currentEntityId);
  const previousHashView = useMapStore((s) => s.previousHashView);
  const previousEntityId = useMapStore((s) => s.previousEntityId);
  const setCurrentHashView = useMapStore((s) => s.setCurrentHashView);

  const navInfo = useMemo(
    () => getHeaderBackNavigation(currentHashView, currentEntityId, previousHashView, previousEntityId),
    [currentHashView, currentEntityId, previousHashView, previousEntityId],
  );

  const handleBack = useCallback(() => {
    setCurrentHashView(navInfo.targetView, navInfo.targetEntityId);
  }, [setCurrentHashView, navInfo.targetView, navInfo.targetEntityId]);

  return {
    ...navInfo,
    handleBack,
  };
}

export interface HeaderBackButtonProps {
  className?: string;
  onClick?: () => void;
}

/**
  what: reusable header back button component.
  how: renders an accessible back button using contextual navigation rules computed by useHeaderBackNavigation.
  with what file: src/utils/headerNavigation.tsx consumed by HeaderBanner and detail headers.
*/
export const HeaderBackButton: React.FC<HeaderBackButtonProps> = ({
  className = 'btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-2 fw-semibold',
  onClick,
}) => {
  const { isDetailPage, label, handleBack } = useHeaderBackNavigation();

  if (!isDetailPage) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (onClick) {
          onClick();
        } else {
          handleBack();
        }
      }}
    >
      {label}
    </button>
  );
};

