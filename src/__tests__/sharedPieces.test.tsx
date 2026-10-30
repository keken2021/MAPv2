import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CountTabs, CountTab } from '../components/common/CountTabs';
import {
  StatusBadge,
  getStatusTone,
  STATUS_TONE_MAP,
  ASSURANCE_STAGE_TONE_MAP,
  VERDICT_TONE_MAP,
  StatusTone,
} from '../components/common/StatusBadge';
import { ListToolbar } from '../components/common/ListToolbar';
import { DetailHeader } from '../components/common/DetailHeader';
import { ReadinessGauge } from '../components/common/ReadinessGauge';
import { EmptyState } from '../components/common/EmptyState';
import { Search, AlertCircle, FileText } from 'lucide-react';
import {
  getReadinessTone,
  getReadinessBgClass,
  getReadinessTextClass,
  READINESS_CUTOFFS,
} from '../config/readinessScale';
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

  it('maps each assurance set stage to neutral tone and each verdict to its semantic colour', () => {
    const stages = ['Initiated', 'Validation', 'Verification', 'Inspection', 'Approval'];
    stages.forEach((stage) => {
      expect(getStatusTone(stage)).toBe('neutral');
      expect(ASSURANCE_STAGE_TONE_MAP[stage]).toBe('neutral');
    });

    const verdicts: Record<string, StatusTone> = {
      Certified: 'success',
      Approved: 'success',
      Overdue: 'warning',
      Rejected: 'danger',
      Cancelled: 'danger',
    };
    Object.entries(verdicts).forEach(([verdict, tone]) => {
      expect(getStatusTone(verdict)).toBe(tone);
      expect(VERDICT_TONE_MAP[verdict]).toBe(tone);
    });

    const { container, rerender } = render(<StatusBadge value="Validation" />);
    expect(screen.getByText('Validation')).toBeInTheDocument();
    expect(container.querySelector('.map-status-badge--neutral')).toBeInTheDocument();

    rerender(<StatusBadge value="Certified" />);
    expect(screen.getByText('Certified')).toBeInTheDocument();
    expect(container.querySelector('.map-status-badge--success')).toBeInTheDocument();
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
  it('renders decorative search icon with aria-hidden and search input with left padding class', () => {
    const { container } = render(
      <ListToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        searchPlaceholder="Search assurance sets..."
      />
    );

    const input = screen.getByPlaceholderText('Search assurance sets...');
    expect(input).toHaveClass('map-list-toolbar-search-input');

    const searchIcon = container.querySelector('.position-relative > svg');
    expect(searchIcon).toBeInTheDocument();
    expect(searchIcon).toHaveAttribute('aria-hidden', 'true');
  });

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

describe('readinessScale and ReadinessGauge', () => {
  it('maps scores to danger (<50), warning (50-84), and success (85+) across boundaries 49, 50, 84, 85', () => {
    expect(READINESS_CUTOFFS.warning).toBe(50);
    expect(READINESS_CUTOFFS.success).toBe(85);

    expect(getReadinessTone(49)).toBe('danger');
    expect(getReadinessBgClass(49)).toBe('bg-danger');
    expect(getReadinessTextClass(49)).toBe('text-danger');

    expect(getReadinessTone(50)).toBe('warning');
    expect(getReadinessBgClass(50)).toBe('bg-warning');
    expect(getReadinessTextClass(50)).toBe('text-warning');

    expect(getReadinessTone(84)).toBe('warning');
    expect(getReadinessBgClass(84)).toBe('bg-warning');
    expect(getReadinessTextClass(84)).toBe('text-warning');

    expect(getReadinessTone(85)).toBe('success');
    expect(getReadinessBgClass(85)).toBe('bg-success');
    expect(getReadinessTextClass(85)).toBe('text-success');
  });

  it('renders ReadinessGauge with correct tone classes and data-tone attribute at boundaries', () => {
    const { container, rerender } = render(<ReadinessGauge score={49} />);
    expect(screen.getByText('49%')).toHaveClass('text-danger');
    expect(container.querySelector('.progress-bar')).toHaveClass('bg-danger');
    expect(container.querySelector('[data-tone="danger"]')).toBeInTheDocument();

    rerender(<ReadinessGauge score={50} />);
    expect(screen.getByText('50%')).toHaveClass('text-warning');
    expect(container.querySelector('.progress-bar')).toHaveClass('bg-warning');
    expect(container.querySelector('[data-tone="warning"]')).toBeInTheDocument();

    rerender(<ReadinessGauge score={84} />);
    expect(screen.getByText('84%')).toHaveClass('text-warning');
    expect(container.querySelector('.progress-bar')).toHaveClass('bg-warning');
    expect(container.querySelector('[data-tone="warning"]')).toBeInTheDocument();

    rerender(<ReadinessGauge score={85} />);
    expect(screen.getByText('85%')).toHaveClass('text-success');
    expect(container.querySelector('.progress-bar')).toHaveClass('bg-success');
    expect(container.querySelector('[data-tone="success"]')).toBeInTheDocument();

    rerender(<ReadinessGauge score={50} size="lg" />);
    expect(screen.getByText('50%')).toHaveClass('text-warning');
    expect(container.querySelector('.progress-bar')).toHaveClass('bg-warning');
  });

  describe('EmptyState', () => {
    it('renders icon at 32px in muted slate and required title', () => {
      const { container } = render(<EmptyState title="Nothing to verify" />);

      expect(screen.getByText('Nothing to verify')).toBeInTheDocument();
      const icon = container.querySelector('[data-testid="empty-state-icon"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('width', '32');
      expect(icon).toHaveAttribute('height', '32');
      expect(icon).toHaveClass('text-secondary');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('renders custom icon when provided', () => {
      const { container } = render(<EmptyState icon={Search} title="No matches" />);

      expect(screen.getByText('No matches')).toBeInTheDocument();
      const icon = container.querySelector('[data-testid="empty-state-icon"]');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('width', '32');
    });

    it('renders optional description only when given', () => {
      const { rerender } = render(<EmptyState title="Nothing to verify" />);
      expect(screen.queryByText(/documents appear here/i)).toBeNull();

      rerender(
        <EmptyState
          title="Nothing to verify"
          description="Documents appear here when a submitter uploads them"
        />,
      );
      expect(
        screen.getByText('Documents appear here when a submitter uploads them'),
      ).toBeInTheDocument();
    });

    it('renders action button only when provided and triggers onClick handler', () => {
      const handleAction = vi.fn();
      const { rerender } = render(<EmptyState title="No matches" />);

      expect(screen.queryByRole('button')).toBeNull();

      rerender(
        <EmptyState
          title="No matches"
          action={{ label: 'Clear filters', onClick: handleAction }}
        />,
      );

      const actionBtn = screen.getByRole('button', { name: 'Clear filters' });
      expect(actionBtn).toBeInTheDocument();
      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });
});
