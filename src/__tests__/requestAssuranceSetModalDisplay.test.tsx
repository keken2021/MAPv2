import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RequestAssuranceSetModal } from '../components/modals/RequestAssuranceSetModal';
import { useMapStore } from '../store/useMapStore';
import {
  NORTHWIND_ORG,
  OIL_CO_LNG_PROJECT_ID,
  OIL_CO_ORG,
} from '../store/oilCoLngPilotMockData';

describe('RequestAssuranceSetModal display and direction', () => {
  beforeEach(() => {
    useMapStore.setState({
      activePersona: 'C Admin',
      activeDemoOrganization: OIL_CO_ORG,
      activeSessionUserId: 'USR-228',
    });
  });

  const renderModal = () => {
    const project = useMapStore.getState().projects.find((p) => p.id === OIL_CO_LNG_PROJECT_ID)!;
    return render(
      <RequestAssuranceSetModal
        isOpen={true}
        onClose={vi.fn()}
        project={project}
        onSuccess={vi.fn()}
      />,
    );
  };

  it('groups options by organization and shows role and party tags on each option', () => {
    renderModal();
    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;

    // Check optgroup grouping
    const optgroups = Array.from(select.querySelectorAll('optgroup'));
    expect(optgroups.some((og) => og.label === NORTHWIND_ORG)).toBe(true);

    const options = Array.from(select.options);

    // Administrator option
    const adminOption = options.find((o) => o.textContent?.includes('K. Osei'));
    expect(adminOption).toBeDefined();
    expect(adminOption?.textContent).toContain('Administrator · Requesting party');

    // Submitter option
    const submitterOption = options.find((o) => o.textContent?.includes('M. Chen'));
    expect(submitterOption).toBeDefined();
    expect(submitterOption?.textContent).toContain('Submitter · Responding party');
  });

  it('shows only sender organization before a pick, and updates banner dynamically per recipient role', () => {
    renderModal();
    const banner = screen.getByTestId('requesting-party-banner');

    // Before pick: shows only sender's organization, no Responding party
    expect(banner).toHaveTextContent(OIL_CO_ORG);
    expect(banner).not.toHaveTextContent('Responding party');

    const select = screen.getByLabelText(/Recipient/) as HTMLSelectElement;
    const adminOption = Array.from(select.options).find((o) => o.textContent?.includes('K. Osei'))!;
    const submitterOption = Array.from(select.options).find((o) => o.textContent?.includes('M. Chen'))!;

    // Pick an Administrator: direction flips
    fireEvent.change(select, { target: { value: adminOption.value } });
    expect(banner).toHaveTextContent(`Requesting party: ${NORTHWIND_ORG}`);
    expect(banner).toHaveTextContent(`Responding party: ${OIL_CO_ORG}`);

    // Pick a Submitter: standard direction
    fireEvent.change(select, { target: { value: submitterOption.value } });
    expect(banner).toHaveTextContent(`Requesting party: ${OIL_CO_ORG}`);
    expect(banner).toHaveTextContent(`Responding party: ${NORTHWIND_ORG}`);
  });
});
