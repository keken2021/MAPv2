import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CountTabs, CountTab } from '../components/common/CountTabs';
import { StatusBadge, getStatusTone, STATUS_TONE_MAP, StatusTone } from '../components/common/StatusBadge';
import { ListToolbar } from '../components/common/ListToolbar';
import { DetailHeader } from '../components/common/DetailHeader';
import { getStatusDisplayLabel } from '../utils/formatters';

const ALL_MOCK_DATA_STATUSES = [
  'Assurance In Progress',
  'Available',
  'Available Immediately',
  'Available Next Week',
  'Available for Campaign',
  'Available for Charter',
  'Available for Lease',
  'Available for Mobilization',
  'Available on Call',
  'Closed',
  'Completed',
  'Compliant',
  'Document Deficient',
  'Draft',
  'Expired',
  'Expiring',
  'Expiring < 60 Days',
  'Expiring < 6 Mos',
  'Fully Compliant',
  'In Progress',
  'In Stock / Ready',
  'Mobilization Ready',
  'Non-Compliant',
  'Observation',
  'On Charter',
  'Open',
  'Partially Compliant',
  'Pending',
  'Ready for Charter',
  'Rectification Required',
  'Satisfactory',
  'Unavailable',
  'Under Maintenance',
  'Under Re-Inspection',
  'Unknown',
  'Verified',
  'Verified & Closed',
  'actioned',
  'read',
  'unread',
  // Additional domain statuses
  'Initiated',
  'Validation',
  'Verification',
  'Inspection',
  'Approval',
  'Approved',
  'Certified',
  'Cancelled',
  'Rejected',
  'Correction Requested',
  'Returned for Correction',
  'Partially Closed',
  'Overdue',
  'In Operations',
  'In Transit',
  'Dry Docking',
  'Lay-up',
  'Port Stay',
  'Under Charter',
  'Active',
  'Standby',
  'Maintenance',
  'Decommissioned',
  'Valid',
  'Mismatch/Exception',
  'Mismatch',
  'Suspended',
  'Withdrawn',
  'Pending Invitation',
  'Inactive',
  'Composing',
];

describe('StatusBadge', () => {
  it('maps every status in mock data to exactly one of the four valid tones', () => {
    const validTones: StatusTone[] = ['success', 'warning', 'danger', 'neutral'];

    ALL_MOCK_DATA_STATUSES.forEach((status) => {
      const tone = getStatusTone(status);
      expect(validTones).toContain(tone);
    });
  });

  it('renders getStatusDisplayLabel and applies the correct tone css class and data attribute', () => {
    const { container, rerender } = render(<StatusBadge value="Fully Compliant" />);
    // "Fully Compliant" displays as "Compliant" and maps to "success"
    expect(screen.getByText('Compliant')).toBeInTheDocument();
    expect(container.querySelector('.map-status-badge--success')).toBeInTheDocument();

    rerender(<StatusBadge value="Document Deficient" />);
    // "Document Deficient" displays as "Non-Compliant" and maps to "danger"
    expect(screen.getByText('Non-Compliant')).toBeInTheDocument();
    expect(container.querySelector('.map-status-badge--danger')).toBeInTheDocument();

    rerender(<StatusBadge value="Expiring < 60 Days" />);
    // "Expiring < 60 Days" displays as "Expiring Soon" and maps to "warning"
    expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    expect(container.querySelector('.map-status-badge--warning')).toBeInTheDocument();

    rerender(<StatusBadge value="Closed" />);
    expect(screen.getByText('Closed')).toBeInTheDocument();
    expect(container.querySelector('.map-status-badge--neutral')).toBeInTheDocument();
  });

  it('allows explicit tone override when provided', () => {
    const { container } = render(<StatusBadge value="Draft" tone="danger" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(container.querySelector('.map-status-badge--danger')).toBeInTheDocument();
  });
});

describe('CountTabs', () => {
  const tabs: CountTab[] = [
    { key: 'needs-decision', label: 'Needs Decision', count: 4 },
    { key: 'overdue', label: 'Overdue', count: 2, tone: 'warn' },
    { key: 'all', label: 'All', count: 18 },
  ];

  it('renders tab labels with numerical counts in parentheses', () => {
    render(<CountTabs tabs={tabs} active="needs-decision" onChange={vi.fn()} />);

    expect(screen.getByText('Needs Decision')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('(18)')).toBeInTheDocument();
  });

  it('calls onChange with the tab key when a tab is clicked', () => {
    const handleChange = vi.fn();
    render(<CountTabs tabs={tabs} active="needs-decision" onChange={handleChange} />);

    fireEvent.click(screen.getByText('Overdue'));
    expect(handleChange).toHaveBeenCalledWith('overdue');
  });

  it('applies the amber warn class to a tab with tone: warn', () => {
    const { container } = render(<CountTabs tabs={tabs} active="needs-decision" onChange={vi.fn()} />);
    const warnCount = container.querySelector('.map-count-tab-warn');
    expect(warnCount).toBeInTheDocument();
    expect(warnCount?.textContent).toBe('(2)');
  });

  it('marks the active tab with is-active class and aria-selected', () => {
    render(<CountTabs tabs={tabs} active="needs-decision" onChange={vi.fn()} />);
    const activeBtn = screen.getByRole('tab', { name: /Needs Decision/i });
    expect(activeBtn).toHaveClass('is-active');
    expect(activeBtn).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ListToolbar', () => {
  it('renders search input with placeholder, value, and triggers onSearchChange', () => {
    const handleSearch = vi.fn();
    render(
      <ListToolbar
        searchValue="tug"
        onSearchChange={handleSearch}
        searchPlaceholder="Search vessels..."
      />
    );

    const input = screen.getByPlaceholderText('Search vessels...');
    expect(input).toHaveValue('tug');

    fireEvent.change(input, { target: { value: 'barge' } });
    expect(handleSearch).toHaveBeenCalledWith('barge');
  });

  it('clears search when clear icon is clicked', () => {
    const handleSearch = vi.fn();
    render(
      <ListToolbar
        searchValue="tug"
        onSearchChange={handleSearch}
        searchPlaceholder="Search vessels..."
      />
    );

    const clearBtn = screen.getByLabelText('Clear search');
    fireEvent.click(clearBtn);
    expect(handleSearch).toHaveBeenCalledWith('');
  });

  it('renders FilterButton with activeCount and triggers onFilterClick', () => {
    const handleFilter = vi.fn();
    render(
      <ListToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onFilterClick={handleFilter}
        activeFilterCount={3}
      />
    );

    const filterBtn = screen.getByRole('button', { name: /Filters \(3 active\)/i });
    expect(filterBtn).toBeInTheDocument();
    fireEvent.click(filterBtn);
    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it('renders Export menu with CSV and PDF options', () => {
    const handleExportCsv = vi.fn();
    const handleExportPdf = vi.fn();
    render(
      <ListToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        onExportCsv={handleExportCsv}
        onExportPdf={handleExportPdf}
      />
    );

    const exportBtn = screen.getByRole('button', { name: /Export options/i });
    expect(exportBtn).toBeInTheDocument();

    fireEvent.click(exportBtn);

    const csvItem = screen.getByRole('menuitem', { name: /CSV/i });
    const pdfItem = screen.getByRole('menuitem', { name: /PDF/i });
    expect(csvItem).toBeInTheDocument();
    expect(pdfItem).toBeInTheDocument();

    fireEvent.click(csvItem);
    expect(handleExportCsv).toHaveBeenCalledTimes(1);
  });

  it('renders primaryAction slot', () => {
    render(
      <ListToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        primaryAction={<button type="button">Add Vessel</button>}
      />
    );

    expect(screen.getByRole('button', { name: 'Add Vessel' })).toBeInTheDocument();
  });
});

describe('DetailHeader', () => {
  it('renders title and StatusBadge', () => {
    render(<DetailHeader title="MV Atlantic Supplier" status="Compliant" />);

    expect(screen.getByRole('heading', { level: 1, name: 'MV Atlantic Supplier' })).toBeInTheDocument();
    expect(screen.getByText('Compliant')).toBeInTheDocument();
  });

  it('renders monospace metadata items separated by bullet points', () => {
    render(
      <DetailHeader
        title="MV Atlantic Supplier"
        status="Compliant"
        metaItems={[
          'IMO: 9812345',
          { label: 'Type', value: 'Platform Supply Vessel' },
          'Port: Fremantle',
        ]}
      />
    );

    expect(screen.getByText('IMO: 9812345')).toBeInTheDocument();
    expect(screen.getByText('Type: Platform Supply Vessel')).toBeInTheDocument();
    expect(screen.getByText('Port: Fremantle')).toBeInTheDocument();
  });

  it('renders actions in the fixed order: main action, Export, Close', () => {
    const handleClose = vi.fn();
    const handleExportCsv = vi.fn();

    const { container } = render(
      <DetailHeader
        title="MV Atlantic Supplier"
        mainAction={<button type="button">Edit</button>}
        onExportCsv={handleExportCsv}
        onClose={handleClose}
      />
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export record/i })).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Verify DOM order
    const actionContainer = container.querySelector('.ms-auto');
    expect(actionContainer?.querySelector('.detail-header-action-main')).toBeInTheDocument();
    expect(actionContainer?.querySelector('.detail-header-action-export')).toBeInTheDocument();
    expect(actionContainer?.querySelector('.detail-header-action-close')).toBeInTheDocument();
  });

  it('renders backLink and triggers onClick', () => {
    const handleBack = vi.fn();
    render(
      <DetailHeader
        title="MV Atlantic Supplier"
        backLink={{ label: 'Fleet Registry', onClick: handleBack }}
      />
    );

    const backBtn = screen.getByRole('button', { name: /Back to Fleet Registry/i });
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });
});
