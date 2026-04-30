import { describe, expect, it } from 'vitest';
import type { DriftCheckPayload } from '@throughline/shared-types';
import { interpretDrift } from './driftRule.js';

const base: DriftCheckPayload = {
  driftScore: 0.1,
  alignmentVerdict: 'aligned',
  fixSuggestion: null,
  suggestedRelink: null,
  reasoning: '',
  model: 'm',
};

describe('interpretDrift', () => {
  it('returns drifted=false for undefined payload', () => {
    const r = interpretDrift(undefined);
    expect(r.drifted).toBe(false);
    expect(r.score).toBeNull();
    expect(r.fixSuggestion).toBeNull();
    expect(r.alignmentVerdict).toBeNull();
  });

  it('returns drifted=false for null payload', () => {
    expect(interpretDrift(null).drifted).toBe(false);
  });

  it('drifts when verdict is tangential', () => {
    const r = interpretDrift({ ...base, alignmentVerdict: 'tangential', driftScore: 0.1 });
    expect(r.drifted).toBe(true);
  });

  it('drifts when verdict is unrelated', () => {
    const r = interpretDrift({ ...base, alignmentVerdict: 'unrelated', driftScore: 0.1 });
    expect(r.drifted).toBe(true);
  });

  it('drifts when score is exactly 0.5', () => {
    const r = interpretDrift({ ...base, alignmentVerdict: 'aligned', driftScore: 0.5 });
    expect(r.drifted).toBe(true);
  });

  it('drifts when score is above 0.5', () => {
    const r = interpretDrift({ ...base, alignmentVerdict: 'indirect', driftScore: 0.9 });
    expect(r.drifted).toBe(true);
  });

  it('does not drift when verdict is aligned and score < 0.5', () => {
    const r = interpretDrift({ ...base, alignmentVerdict: 'aligned', driftScore: 0.49 });
    expect(r.drifted).toBe(false);
  });

  it('passes through fixSuggestion and verdict', () => {
    const r = interpretDrift({
      ...base,
      alignmentVerdict: 'tangential',
      fixSuggestion: 'Re-link',
    });
    expect(r.fixSuggestion).toBe('Re-link');
    expect(r.alignmentVerdict).toBe('tangential');
  });
});
