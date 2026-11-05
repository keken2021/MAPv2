/*
  file summary: vessel detail status values render through StatusBadge tones.
  role in system: automated coverage for Task 5446.
*/

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StatusBadge, getStatusTone } from '../components/common/StatusBadge';

describe('vessel detail StatusBadge tones', () => {
  const cases: Array<{ value: string; tone: ReturnType<typeof getStatusTone> }> = [
    { value: 'Completed', tone: 'success' },
    { value: 'Approved', tone: 'success' },
    { value: 'Satisfactory', tone: 'success' },
    { value: 'Verified & Closed', tone: 'success' },
    { value: 'Active', tone: 'success' },
    { value: 'In Progress', tone: 'warning' },
    { value: 'Observation', tone: 'warning' },
    { value: 'Under Re-Inspection', tone: 'warning' },
    { value: 'Returned for Correction', tone: 'warning' },
    { value: 'Rejected', tone: 'danger' },
    { value: 'Rectification Required', tone: 'danger' },
  ];

  it.each(cases)('maps $value to $tone', ({ value, tone }) => {
    expect(getStatusTone(value)).toBe(tone);
    const { container } = render(<StatusBadge value={value} />);
    const el = container.querySelector('[data-tone]');
    expect(el).toHaveAttribute('data-tone', tone);
    expect(el).toHaveAttribute('data-status', value);
  });
});
