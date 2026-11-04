import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useMapStore } from '../store/useMapStore';
import { CreateAssuranceSetView } from '../views/CreateAssuranceSetView';
import { AssuranceDetailView } from '../views/AssuranceDetailView';
import { clickNext, pickReviewerRoles } from './assuranceWizardTestHelpers';
import { AssuranceSet } from '../types/assurance';

const initialState = useMapStore.getState();

describe('Assurance Set Parties - Requesting and Responding party only (Task 5349)', () => {
  beforeEach(() => {
    useMapStore.setState(initialState, true);
    useMapStore.setState({
      assuranceSets: [],
      isAuthenticated: true,
      activePersona: 'Administrator',
      activeDemoOrganization: 'Chevron Australia Pty Ltd',
    });
  });

  it('Create wizard step 3 rows do not display Client or Provider badges', () => {
    const { container } = render(<CreateAssuranceSetView />);

    // In step 1 (General), section 3 is Organizations Card
    const orgRows = container.querySelectorAll('[data-testid^="set-organization-"]');
    expect(orgRows.length).toBeGreaterThan(0);

    orgRows.forEach((row) => {
      const badges = Array.from(row.querySelectorAll('.badge')).map((b) => b.textContent?.trim());
      expect(badges).not.toContain('Client');
      expect(badges).not.toContain('Provider');

      // Party role dropdown is present with Requesting and Responding party options
      const select = row.querySelector('select[id^="party-role-"]');
      expect(select).not.toBeNull();
      const optionTexts = Array.from(select!.querySelectorAll('option')).map((o) => o.textContent?.trim());
      expect(optionTexts).toContain('Requesting party');
      expect(optionTexts).toContain('Responding party');
      expect(optionTexts).not.toContain('Client');
      expect(optionTexts).not.toContain('Provider');
      expect(optionTexts).not.toContain('Vendor');
    });
  });

  it('Create wizard objects step does not display a Vendor badge', () => {
    const { container } = render(<CreateAssuranceSetView />);
    // Step 1 -> Step 2: Objects
    clickNext();

    expect(container.querySelector('[data-testid="selected-vendor-badge"]')).toBeNull();
    const allBadges = Array.from(container.querySelectorAll('.badge')).map((b) => b.textContent?.trim() || '');
    allBadges.forEach((badgeText) => {
      expect(badgeText).not.toMatch(/^Vendor:/i);
    });
  });

  it('Create wizard review step displays Requesting party and Responding party lines without Client or Vendor labels', () => {
    const { container } = render(<CreateAssuranceSetView />);
    pickReviewerRoles(container);
    clickNext(); // to Objects
    clickNext(); // to Requirements
    clickNext(); // to Review

    const clientEl = screen.getByTestId('review-client');
    const vendorEl = screen.getByTestId('review-vendor');

    expect(clientEl.textContent).toContain('Requesting party:');
    expect(clientEl.textContent).not.toContain('Client:');

    expect(vendorEl.textContent).toContain('Responding party:');
    expect(vendorEl.textContent).not.toContain('Vendor:');
  });

  it('AssuranceDetailView displays Requesting party and Responding party and no Client line', () => {
    const mockSet: AssuranceSet = {
      ...initialState.assuranceSets[0],
      id: 'AS-TEST-5349',
      title: 'Requesting and Responding Party Test Set',
      clientOrg: 'Chevron Australia Pty Ltd',
      serviceProviderOrg: 'Northwind Marine Pty Ltd',
      requestingParty: 'Chevron Australia Pty Ltd',
      respondingParty: 'Northwind Marine Pty Ltd',
      stage: 'Initiated',
      readinessScore: 50,
      requirements: [],
    } as unknown as AssuranceSet;

    useMapStore.setState({
      assuranceSets: [mockSet, ...initialState.assuranceSets],
    });

    const { container } = render(<AssuranceDetailView setId={mockSet.id} />);

    const requestingEl = screen.getByTestId('detail-requesting-party');
    const respondingEl = screen.getByTestId('detail-responding-party');

    expect(requestingEl.textContent).toContain('Requesting party:');
    expect(requestingEl.textContent).toContain('Chevron Australia Pty Ltd');

    expect(respondingEl.textContent).toContain('Responding party:');
    expect(respondingEl.textContent).toContain('Northwind Marine Pty Ltd');

    // Verify there is no "Client:" line in the details sidebar
    const detailRows = Array.from(container.querySelectorAll('.map-detail-row'));
    detailRows.forEach((row) => {
      const label = row.querySelector('.text-secondary');
      if (label) {
        expect(label.textContent?.trim()).not.toBe('Client:');
      }
    });
  });
});
