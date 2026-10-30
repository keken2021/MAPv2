import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DueCell, getDueStatus } from '../components/common/DueCell';

describe('DueCell and getDueStatus', () => {
  const fixedToday = new Date('2026-10-30T12:00:00Z');

  it('renders late flag in red text when open and past due', () => {
    // 30 days before today
    render(<DueCell date="2026-09-30" isClosed={false} today={fixedToday} />);

    const cell = screen.getByText(/30 days late/i);
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveClass('text-danger');
    expect(cell).toHaveClass('fw-semibold');
  });

  it('renders normal formatted date and does not show late when closed past due', () => {
    // Past due date, but closed
    render(<DueCell date="2026-09-30" isClosed={true} today={fixedToday} />);

    expect(screen.queryByText(/late/i)).toBeNull();
    const cell = screen.getByText(/30 SEP/i);
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveClass('text-secondary');
    expect(cell).not.toHaveClass('text-danger');
  });

  it('renders normal formatted date for future dates', () => {
    // Future date (beyond 90-day warning)
    render(<DueCell date="2027-04-15" today={fixedToday} />);

    expect(screen.queryByText(/late/i)).toBeNull();
    const cell = screen.getByText('15 APR 2027');
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveClass('text-secondary');
  });

  it('renders warning style when document is in expiring window', () => {
    // 30 days in future (within 90-day EXPIRY_WARNING_DAYS)
    render(<DueCell date="2026-11-29" isExpiry={true} today={fixedToday} />);

    expect(screen.queryByText(/expired/i)).toBeNull();
    const cell = screen.getByText('29 NOV 2026');
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveClass('text-warning');
    expect(cell).toHaveClass('fw-semibold');
  });

  it('renders expired text in red for documents past their expiry date', () => {
    // Expired document
    render(<DueCell date="2026-10-15" isExpiry={true} today={fixedToday} />);

    const cell = screen.getByText('Expired');
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveClass('text-danger');
    expect(cell).toHaveClass('fw-semibold');
  });

  it('handles empty or invalid dates gracefully', () => {
    const { container } = render(<DueCell date={undefined} />);
    expect(container.textContent).toBe('—');
  });

  it('computes due status correctly via getDueStatus helper', () => {
    const late = getDueStatus('2026-09-30', { isClosed: false, today: fixedToday });
    expect(late.state).toBe('late');
    expect(late.daysLate).toBe(30);

    const closed = getDueStatus('2026-09-30', { isClosed: true, today: fixedToday });
    expect(closed.state).toBe('closed');

    const expired = getDueStatus('2026-10-15', { isExpiry: true, today: fixedToday });
    expect(expired.state).toBe('expired');
    expect(expired.label).toBe('Expired');

    const expiringSoon = getDueStatus('2026-11-29', { isExpiry: true, today: fixedToday });
    expect(expiringSoon.state).toBe('expiring_soon');

    const future = getDueStatus('2027-04-15', { today: fixedToday });
    expect(future.state).toBe('future');
  });

  it('correctly handles CAPA items: CAPA-109 shows as late while closed CAPA does not', () => {
    // CAPA-109 (due 30 Sep 2026, Open)
    const { unmount } = render(
      <DueCell date="30 Sep 2026" status="Open" today={fixedToday} />
    );
    const lateCell = screen.getByText(/late/i);
    expect(lateCell).toBeInTheDocument();
    expect(lateCell).toHaveClass('text-danger');
    unmount();

    // CAPA-103 (due 12 Sep 2026, Verified & Closed)
    render(
      <DueCell date="12 Sep 2026" status="Verified & Closed" today={fixedToday} />
    );
    expect(screen.queryByText(/late/i)).toBeNull();
    const formattedCell = screen.getByText(/12 SEP/i);
    expect(formattedCell).toBeInTheDocument();
    expect(formattedCell).not.toHaveClass('text-danger');
  });
});
