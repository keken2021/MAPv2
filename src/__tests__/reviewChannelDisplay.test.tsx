/*
  file summary: tests for the on-screen text of an assurance set's review channel.
  responsibilities: checks the label of each review mode, the channel list of a mixed set, the label of a set with no review mode, and the row on the assurance set detail panel.
  role in system: guards formatReviewChannel in src/utils/formatters.ts and the Review Channel row of AssuranceDetailView.tsx.
*/

import React from 'react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { useMapStore } from '../store/useMapStore';
import { formatReviewChannel, REVIEW_CHANNEL_NOT_SET_LABEL } from '../utils/formatters';

describe('Review channel display', () => {
  it('names a single review mode', () => {
    expect(formatReviewChannel({ reviewMode: 'internal', reviewChannels: ['internal'] })).toBe('Internal');
    expect(formatReviewChannel({ reviewMode: 'third_party', reviewChannels: ['third_party'] })).toBe('Third Party');
    expect(formatReviewChannel({ reviewMode: 'issuing_authority' })).toBe('Issuing Authority');
  });

  it('lists the channels of a mixed set', () => {
    expect(
      formatReviewChannel({ reviewMode: 'mixed', reviewChannels: ['third_party', 'issuing_authority'] }),
    ).toBe('Mixed (Third Party, Issuing Authority)');
  });

  it('shows a mixed set with no channel list as Mixed', () => {
    expect(formatReviewChannel({ reviewMode: 'mixed' })).toBe('Mixed');
    expect(formatReviewChannel({ reviewMode: 'mixed', reviewChannels: [] })).toBe('Mixed');
  });

  it('shows a set with no review mode as not set', () => {
    expect(formatReviewChannel({})).toBe(REVIEW_CHANNEL_NOT_SET_LABEL);
  });
});

describe('Review channel on the assurance set detail panel', () => {
  const initialState = useMapStore.getState();

  beforeEach(() => {
    useMapStore.setState(initialState, true);
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    ['AS-2026-024', 'Internal'],
    ['AS-2026-001', 'Mixed (Third Party, Issuing Authority)'],
    ['AS-2026-002', 'Mixed (Internal, Third Party)'],
  ])('shows the review channel of %s', (setId, expected) => {
    render(<AssuranceDetailView setId={setId} />);
    expect(screen.getByText('Review Channel:').nextElementSibling?.textContent).toBe(expected);
  });

  it('shows not set for a set that records no review mode', () => {
    const seeded = initialState.assuranceSets.find((s) => s.id === 'AS-2026-024')!;
    useMapStore.setState({
      assuranceSets: [{ ...seeded, id: 'AS-TEST-NO-MODE', reviewMode: undefined, reviewChannels: undefined }],
    });
    render(<AssuranceDetailView setId="AS-TEST-NO-MODE" />);
    expect(screen.getByText('Review Channel:').nextElementSibling?.textContent).toBe(REVIEW_CHANNEL_NOT_SET_LABEL);
  });
});
