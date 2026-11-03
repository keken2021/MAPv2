import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InspectionChecklistView } from '../views/InspectionChecklistView';
import { InspectionDrawer } from '../components/drawers/InspectionDrawer';
import { useMapStore } from '../store/useMapStore';
import * as exportHelpers from '../utils/exportHelpers';

vi.mock('../utils/exportHelpers', () => ({
  exportToCsv: vi.fn(),
  exportToPdf: vi.fn(),
}));

describe('Inspection Checklist & Drawer - Read Set and Seeded Records (Task 5310)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({
      activePersona: 'Inspector',
      currentHashView: 'inspector',
      currentEntityId: undefined,
    });
  });

  it('renders the checklist on two sets and compares headers, location, date, and row counts', () => {
    // 1. Render for set AS-2026-001
    const { unmount: unmountFirst } = render(<InspectionChecklistView setId="AS-2026-001" />);

    expect(screen.getByText('AS-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Dampier Port Facility, WA')).toBeInTheDocument();
    expect(screen.getByText('14 Oct 2026')).toBeInTheDocument();

    const locInput1 = screen.getByTestId('inspection-location-input') as HTMLInputElement;
    const dateInput1 = screen.getByTestId('inspection-date-input') as HTMLInputElement;
    expect(locInput1.value).toBe('Dampier Port Facility, WA');
    expect(dateInput1.value).toBe('14 Oct 2026');

    const count1 = screen.getByTestId('checklist-count');
    expect(count1.textContent).toContain('5 SOLAS / ISM Verification Points');

    const rows1 = screen.getAllByTestId('checklist-item-row');
    expect(rows1).toHaveLength(5);

    // Verify absence of hardcoded literals
    expect(screen.queryByText('AS-2041')).toBeNull();
    expect(screen.queryByText(/Berth 4, Fremantle/)).toBeNull();

    unmountFirst();

    // 2. Render for set AS-2026-008
    render(<InspectionChecklistView setId="AS-2026-008" />);

    expect(screen.getByText('AS-2026-008')).toBeInTheDocument();
    expect(screen.getByText('Henderson, WA')).toBeInTheDocument();
    expect(screen.getByText('22 Oct 2026')).toBeInTheDocument();

    const locInput2 = screen.getByTestId('inspection-location-input') as HTMLInputElement;
    const dateInput2 = screen.getByTestId('inspection-date-input') as HTMLInputElement;
    expect(locInput2.value).toBe('Henderson, WA');
    expect(dateInput2.value).toBe('22 Oct 2026');

    const count2 = screen.getByTestId('checklist-count');
    expect(count2.textContent).toContain('3 SOLAS / ISM Verification Points');

    const rows2 = screen.getAllByTestId('checklist-item-row');
    expect(rows2).toHaveLength(3);

    // Headers and row counts differ between the two sets
    expect(locInput1.value).not.toBe(locInput2.value);
    expect(dateInput1.value).not.toBe(dateInput2.value);
    expect(count1.textContent).not.toBe(count2.textContent);
    expect(rows1.length).not.toBe(rows2.length);

    expect(screen.queryByText('AS-2041')).toBeNull();
    expect(screen.queryByText(/Berth 4, Fremantle/)).toBeNull();
  });

  it('allows editing inspection location and date fields and updates header meta', () => {
    render(<InspectionChecklistView setId="AS-2026-001" />);

    const locInput = screen.getByTestId('inspection-location-input') as HTMLInputElement;
    const dateInput = screen.getByTestId('inspection-date-input') as HTMLInputElement;

    fireEvent.change(locInput, { target: { value: 'Port Hedland Berth 2' } });
    fireEvent.change(dateInput, { target: { value: '25 Oct 2026' } });

    expect(locInput.value).toBe('Port Hedland Berth 2');
    expect(dateInput.value).toBe('25 Oct 2026');
    expect(screen.getByText('Port Hedland Berth 2')).toBeInTheDocument();
    expect(screen.getByText('25 Oct 2026')).toBeInTheDocument();
  });

  it('exports CSV and PDF with dynamic set id, location, and date without literals', () => {
    render(<InspectionChecklistView setId="AS-2026-001" />);

    // Open export dropdown and trigger CSV export
    const exportBtn = screen.getByLabelText(/Export record/i);
    fireEvent.click(exportBtn);

    const csvBtn = screen.getByRole('menuitem', { name: /csv/i });
    fireEvent.click(csvBtn);

    expect(exportHelpers.exportToCsv).toHaveBeenCalled();
    const csvArgs = vi.mocked(exportHelpers.exportToCsv).mock.calls[0];
    const summaryRow = csvArgs[1][0] as Record<string, string>;
    expect(summaryRow.TitleOrAction).toContain('AS-2026-001');
    expect(summaryRow.TitleOrAction).toContain('Dampier Port Facility, WA');
    expect(summaryRow.TitleOrAction).toContain('14 Oct 2026');
    expect(summaryRow.TitleOrAction).not.toContain('AS-2041');
    expect(summaryRow.TitleOrAction).not.toContain('Berth 4, Fremantle');

    // Trigger PDF export
    fireEvent.click(exportBtn);
    const pdfBtn = screen.getByRole('menuitem', { name: /pdf/i });
    fireEvent.click(pdfBtn);

    expect(exportHelpers.exportToPdf).toHaveBeenCalled();
    const pdfArgs = vi.mocked(exportHelpers.exportToPdf).mock.calls[0];
    const pdfSummaryRow = pdfArgs[2][0] as string[];
    expect(pdfSummaryRow[1]).toContain('AS-2026-001');
    expect(pdfSummaryRow[1]).toContain('Dampier Port Facility, WA');
    expect(pdfSummaryRow[1]).toContain('14 Oct 2026');
    expect(pdfSummaryRow[1]).not.toContain('AS-2041');
    expect(pdfSummaryRow[1]).not.toContain('Berth 4, Fremantle');
  });

  it('InspectionDrawer reads set id, seeded location, date, and store CAPAs without literal AS-2041', () => {
    const handleClose = vi.fn();

    // 1. Render for AS-2026-001
    const { unmount } = render(
      <InspectionDrawer
        vesselName="MV Pacific Endeavour"
        setId="AS-2026-001"
        onClose={handleClose}
      />
    );

    const drawerMeta1 = screen.getByText(/AS-2026-001/);
    expect(drawerMeta1).toBeInTheDocument();
    expect(drawerMeta1.textContent).toContain('MV Pacific Endeavour');
    expect(drawerMeta1.textContent).toContain('Dampier Port Facility, WA');
    expect(drawerMeta1.textContent).toContain('14 Oct 2026');
    expect(drawerMeta1.textContent).not.toContain('AS-2041');
    expect(drawerMeta1.textContent).not.toContain('Berth 4, Fremantle');

    const drawerRows1 = screen.getAllByTestId('checklist-item-row');
    expect(drawerRows1).toHaveLength(5);

    unmount();

    // 2. Render for AS-2026-008
    render(
      <InspectionDrawer
        vesselName="MV Northern Discovery"
        setId="AS-2026-008"
        onClose={handleClose}
      />
    );

    const drawerMeta2 = screen.getByText(/AS-2026-008/);
    expect(drawerMeta2).toBeInTheDocument();
    expect(drawerMeta2.textContent).toContain('MV Northern Discovery');
    expect(drawerMeta2.textContent).toContain('Henderson, WA');
    expect(drawerMeta2.textContent).toContain('22 Oct 2026');
    expect(drawerMeta2.textContent).not.toContain('AS-2041');

    const drawerRows2 = screen.getAllByTestId('checklist-item-row');
    expect(drawerRows2).toHaveLength(3);
  });
});
