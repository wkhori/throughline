import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AIStatusIndicator } from '@throughline/shared-ui';
import type {
  OutcomeCandidateDto,
  RcdoTreeDto,
  SuggestOutcomePayload,
} from '@throughline/shared-types';
import { useSuggestOutcomeMutation } from '../../api/aiEndpoints.js';
import { SoLinkerChip } from './SoLinkerChip.js';
import { SoLinkerTypeahead } from './SoLinkerTypeahead.js';

const DEBOUNCE_MS = 500;
const MIN_LEN = 15;
const CONFIDENCE_THRESHOLD = 0.6;

type State = 'INITIAL' | 'THINKING' | 'SUGGESTED' | 'TYPEAHEAD_OPEN' | 'FILLED';

export interface SoLinkerHandle {
  /** Focus the linker — opens the typeahead and focuses its input. */
  focus: () => void;
}

export interface SoLinkerProps {
  rcdo: RcdoTreeDto | undefined;
  commitText: string;
  value: string | null;
  onChange: (soId: string | null) => void;
  disabled?: boolean;
}

/**
 * AI-first Supporting Outcome linker. Replaces the legacy 4-dropdown RCDO cascade.
 *
 * State machine:
 *   INITIAL ──(commitText ≥ 15 chars, debounce 500ms)──▶ THINKING (T1 in flight)
 *   THINKING ──(confidence ≥ 0.6)──▶ SUGGESTED (chip filled, full breadcrumb)
 *   THINKING ──(low confidence OR error)──▶ TYPEAHEAD_OPEN
 *   SUGGESTED ──(user clicks "change")──▶ TYPEAHEAD_OPEN
 *   TYPEAHEAD_OPEN ──(user picks SO)──▶ FILLED
 *   FILLED ──(commitText changes)──▶ THINKING (re-run)
 *
 * The SO is the form's single source of truth — we lift the value/onChange so the
 * parent <CommitForm> doesn't need to know which sub-state we're in.
 */
export const SoLinker = forwardRef<SoLinkerHandle, SoLinkerProps>(function SoLinker(
  { rcdo, commitText, value, onChange, disabled }: SoLinkerProps,
  ref,
) {
  const candidates = useMemo(() => flattenCandidates(rcdo), [rcdo]);
  const candidateById = useMemo(() => {
    const m = new Map<string, OutcomeCandidateDto>();
    for (const c of candidates) m.set(c.supportingOutcomeId, c);
    return m;
  }, [candidates]);

  const [state, setState] = useState<State>(() => (value ? 'FILLED' : 'INITIAL'));
  const [aiSuggested, setAiSuggested] = useState(false);
  const lastFiredRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [suggest] = useSuggestOutcomeMutation();

  useImperativeHandle(
    ref,
    (): SoLinkerHandle => ({
      focus: () => {
        setState((s) => (s === 'FILLED' || s === 'SUGGESTED' ? 'TYPEAHEAD_OPEN' : s));
        // Defer focus to next tick so the input is mounted.
        window.setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      },
    }),
    [],
  );

  // The SoLinker only fires T1 when (a) we don't already have a user-confirmed value,
  // (b) the commit text is long enough, and (c) we're not already in the typeahead.
  const shouldFireAi = useMemo(() => {
    if (disabled) return false;
    if (state === 'TYPEAHEAD_OPEN') return false;
    if (state === 'FILLED' && !aiSuggested) return false;
    if (commitText.trim().length < MIN_LEN) return false;
    if (candidates.length === 0) return false;
    return true;
  }, [disabled, state, aiSuggested, commitText, candidates.length]);

  // Debounced T1 dispatch.
  useEffect(() => {
    if (!shouldFireAi) return;
    const key = commitText.trim();
    if (key === lastFiredRef.current) return;

    setState((s) => (s === 'INITIAL' || s === 'SUGGESTED' || s === 'FILLED' ? 'THINKING' : s));

    const handle = window.setTimeout(() => {
      lastFiredRef.current = key;
      void (async () => {
        try {
          const result = await suggest({ draftCommitText: key, candidates }).unwrap();
          const payload = result.payload as SuggestOutcomePayload | undefined;
          if (
            payload &&
            payload.supportingOutcomeId &&
            payload.confidence >= CONFIDENCE_THRESHOLD &&
            candidateById.has(payload.supportingOutcomeId)
          ) {
            onChange(payload.supportingOutcomeId);
            setAiSuggested(true);
            setState('SUGGESTED');
          } else {
            // Empty or low-confidence — let the user search.
            setAiSuggested(false);
            setState('TYPEAHEAD_OPEN');
          }
        } catch {
          // Silent-degrade per ai-copilot-spec.md. Drop into typeahead so the IC
          // can still link manually.
          setAiSuggested(false);
          setState('TYPEAHEAD_OPEN');
        }
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [shouldFireAi, commitText, candidates, candidateById, onChange, suggest]);

  const indicatorState =
    state === 'THINKING'
      ? 'thinking'
      : state === 'SUGGESTED' || (state === 'FILLED' && aiSuggested)
        ? 'suggested'
        : 'idle';

  const filledCandidate = value ? (candidateById.get(value) ?? null) : null;
  const showChip = (state === 'SUGGESTED' || state === 'FILLED') && filledCandidate !== null;
  const showTypeahead = state === 'TYPEAHEAD_OPEN' || (!showChip && state !== 'THINKING');

  const handleOpenTypeahead = useCallback(() => {
    setState('TYPEAHEAD_OPEN');
    setAiSuggested(false);
    // Focus the input on next tick.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handlePick = useCallback(
    (c: OutcomeCandidateDto) => {
      onChange(c.supportingOutcomeId);
      setAiSuggested(false);
      lastFiredRef.current = commitText.trim();
      setState('FILLED');
    },
    [commitText, onChange],
  );

  const handleClose = useCallback(() => {
    if (filledCandidate) setState('FILLED');
    else setState('INITIAL');
  }, [filledCandidate]);

  return (
    <div data-testid="so-linker" data-state={state} className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wide text-(--color-shell-muted)">
          Supporting Outcome
        </label>
        <AIStatusIndicator
          state={indicatorState}
          label={
            indicatorState === 'thinking'
              ? 'Thinking…'
              : indicatorState === 'suggested'
                ? 'AI suggested'
                : undefined
          }
        />
      </div>
      {showChip && filledCandidate ? (
        <SoLinkerChip
          candidate={filledCandidate}
          aiSuggested={aiSuggested}
          onChange={handleOpenTypeahead}
          disabled={disabled}
        />
      ) : showTypeahead ? (
        <SoLinkerTypeahead
          ref={inputRef}
          candidates={candidates}
          onPick={handlePick}
          onClose={handleClose}
          disabled={disabled}
        />
      ) : (
        // THINKING with no prior value — keep height stable with a placeholder line.
        <p className="text-xs italic text-(--color-shell-muted)">Looking for a likely outcome…</p>
      )}
    </div>
  );
});

function flattenCandidates(tree: RcdoTreeDto | undefined): OutcomeCandidateDto[] {
  if (!tree) return [];
  const out: OutcomeCandidateDto[] = [];
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        for (const so of o.supportingOutcomes) {
          out.push({
            supportingOutcomeId: so.id,
            title: so.title,
            parentOutcomeTitle: o.title,
            parentDOTitle: defo.title,
            parentRallyCryTitle: rc.title,
          });
        }
      }
    }
  }
  return out;
}
