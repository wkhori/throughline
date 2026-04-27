package com.throughline.weeklycommit.infrastructure.ai;

/**
 * Outputs from a single Anthropic call.
 *
 * @param model the responding model id (e.g. {@code claude-haiku-4-5-20251001})
 * @param contentJson the assistant's text content — expected to be a single valid JSON object
 *     matching the per-touchpoint schema; client does not parse it
 * @param tokensInput billed input tokens
 * @param tokensOutput billed output tokens
 * @param tokensCacheRead cache-read tokens (priced at 0.10× input per docs/ai-copilot-spec.md)
 * @param latencyMs wall-clock latency including retries
 */
public record AnthropicResponse(
    String model,
    String contentJson,
    int tokensInput,
    int tokensOutput,
    int tokensCacheRead,
    int latencyMs) {}
