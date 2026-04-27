import { describe, expect, it } from 'vitest';
import { buildDriftDetail, formatShare } from './DigestHero.js';

describe('formatShare', () => {
  it('treats a decimal fraction (≤1) as a share and multiplies by 100', () => {
    expect(formatShare(0.1167)).toBe('11.7%');
    expect(formatShare(0.4545)).toBe('45.5%');
    expect(formatShare(0)).toBe('0%');
    expect(formatShare(1)).toBe('100%');
  });

  it('passes through whole-percent numbers without re-multiplying', () => {
    expect(formatShare(16.7)).toBe('16.7%');
    expect(formatShare(45)).toBe('45%');
  });

  it('passes through percent strings unchanged', () => {
    expect(formatShare('16.7%')).toBe('16.7%');
    expect(formatShare('40–55%')).toBe('40–55%');
  });

  it('coerces a numeric string with no % symbol', () => {
    // The AI occasionally serialises shares as bare numerics in a string;
    // detect and treat as decimal/whole-percent the same way we do for numbers.
    expect(formatShare('0.215')).toBe('21.5%');
    expect(formatShare('21')).toBe('21%');
  });

  it('returns an empty string for null / undefined / blank input', () => {
    expect(formatShare(null)).toBe('');
    expect(formatShare(undefined)).toBe('');
    expect(formatShare('')).toBe('');
    expect(formatShare('   ')).toBe('');
  });

  it('drops trailing .0 so 0.5 renders as "50%" not "50.0%"', () => {
    expect(formatShare(0.5)).toBe('50%');
  });
});

describe('buildDriftDetail', () => {
  it('renders the full sentence when observed + expected + direction are all present', () => {
    expect(buildDriftDetail('17%', '40–55%', 'UNDER')).toBe(
      'Observed 17% vs expected 40–55% (UNDER).',
    );
  });

  it('omits the direction parens when direction is empty but the rest is present', () => {
    expect(buildDriftDetail('17%', '40–55%', '')).toBe('Observed 17% vs expected 40–55%.');
  });

  it('falls back to observed-only copy when expectedRange is missing', () => {
    expect(buildDriftDetail('45.5%', '', 'OVER')).toBe(
      'Observed share 45.5% (OVER); expected range not provided.',
    );
  });

  it('uses the generic last-resort copy when neither observed nor expected is provided', () => {
    expect(buildDriftDetail('', '', '')).toBe(
      'Drift detected against the team priority weights — no observed share returned.',
    );
  });
});
