package com.throughline.weeklycommit.infrastructure.ai;

import com.throughline.weeklycommit.domain.AIInsightKind;

/**
 * Inputs to a single Anthropic call. {@code systemPrompt} is the prompt-cached preamble (verbatim
 * from docs/ai-copilot-spec.md); {@code userPrompt} is the per-call dynamic body. {@code
 * promptTemplateName} keys the stub fixture lookup.
 *
 * @param model selector (Haiku/Sonnet)
 * @param promptTemplateName stable template identifier (T1/T2/T3/T4/T5/T6/T7)
 * @param kind insight-kind tag persisted alongside the response
 * @param systemPrompt the prompt-cached system message
 * @param userPrompt the per-call user message (already JSON-serialized)
 * @param maxTokens caller-supplied output cap
 */
public record AnthropicRequest(
    AnthropicModel model,
    String promptTemplateName,
    AIInsightKind kind,
    String systemPrompt,
    String userPrompt,
    int maxTokens) {}
