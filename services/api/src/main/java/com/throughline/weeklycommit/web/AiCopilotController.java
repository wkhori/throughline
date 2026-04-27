package com.throughline.weeklycommit.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.ai.AiCopilotService;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI Copilot endpoints for Phase 5a (T1 / T2 / T7). T3/T4/T5/T6 ship in Phases 5b–5c.
 *
 * <p>Each endpoint is debounced from the frontend per spec (T1 800ms / T2 1500ms / T7 1000ms);
 * server-side cost guard rejects callers who breach per-user-per-hour caps with 429
 * BUDGET_EXHAUSTED.
 */
@RestController
@RequestMapping("/api/v1/ai")
public class AiCopilotController {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final AiCopilotService aiService;
  private final CurrentUserResolver currentUser;

  public AiCopilotController(AiCopilotService aiService, CurrentUserResolver currentUser) {
    this.aiService = aiService;
    this.currentUser = currentUser;
  }

  @PostMapping("/suggest-outcome")
  public ResponseEntity<AIInsightDto> suggestOutcome(
      @Valid @RequestBody SuggestOutcomeRequest body) {
    User u = currentUser.requireCurrentUser();
    AiCopilotService.SuggestOutcomeInput input =
        new AiCopilotService.SuggestOutcomeInput(
            body.draftCommitText(),
            u.getId(),
            u.getTeamId(),
            body.candidates().stream()
                .map(
                    c ->
                        new AiCopilotService.OutcomeCandidate(
                            c.supportingOutcomeId(),
                            c.title(),
                            c.parentOutcomeTitle(),
                            c.parentDOTitle(),
                            c.parentRallyCryTitle()))
                .toList(),
            body.recentUserCommits() == null ? List.of() : body.recentUserCommits());
    AIInsight insight = aiService.suggestOutcome(input, u.getId(), u.getOrgId());
    return ResponseEntity.status(HttpStatus.OK).body(AIInsightDto.from(insight));
  }

  @PostMapping("/drift-check")
  public ResponseEntity<AIInsightDto> driftCheck(@Valid @RequestBody DriftCheckRequest body) {
    User u = currentUser.requireCurrentUser();
    AiCopilotService.DriftCheckInput input =
        new AiCopilotService.DriftCheckInput(
            body.commitId(),
            body.commitText(),
            new AiCopilotService.LinkedOutcome(
                body.linkedOutcome().supportingOutcomeId(),
                body.linkedOutcome().title(),
                body.linkedOutcome().parentOutcomeTitle(),
                body.linkedOutcome().parentDOTitle(),
                body.linkedOutcome().metricStatement()),
            body.alternativeOutcomes().stream()
                .map(
                    a ->
                        new AiCopilotService.AlternativeOutcome(a.supportingOutcomeId(), a.title()))
                .toList());
    AIInsight insight = aiService.checkDrift(input, u.getId(), u.getOrgId());
    return ResponseEntity.status(HttpStatus.OK).body(AIInsightDto.from(insight));
  }

  @PostMapping("/quality-lint")
  public ResponseEntity<AIInsightDto> qualityLint(@Valid @RequestBody QualityLintRequest body) {
    User u = currentUser.requireCurrentUser();
    AiCopilotService.QualityLintInput input =
        new AiCopilotService.QualityLintInput(
            body.commitId(),
            body.commitText(),
            body.category(),
            body.priority(),
            body.supportingOutcomeTitle());
    AIInsight insight = aiService.qualityLint(input, u.getId(), u.getOrgId());
    return ResponseEntity.status(HttpStatus.OK).body(AIInsightDto.from(insight));
  }

  // ---------- Request DTOs ----------

  public record SuggestOutcomeRequest(
      @NotBlank @Size(min = 15, max = 500) String draftCommitText,
      @NotNull @Size(min = 1, max = 25) List<CandidateDto> candidates,
      List<java.util.Map<String, String>> recentUserCommits) {}

  public record CandidateDto(
      @NotBlank String supportingOutcomeId,
      @NotBlank String title,
      @NotBlank String parentOutcomeTitle,
      @NotBlank String parentDOTitle,
      @NotBlank String parentRallyCryTitle) {}

  public record DriftCheckRequest(
      @NotBlank String commitId,
      @NotBlank @Size(min = 5, max = 280) String commitText,
      @NotNull @Valid LinkedOutcomeDto linkedOutcome,
      @NotNull List<AlternativeOutcomeDto> alternativeOutcomes) {}

  public record LinkedOutcomeDto(
      @NotBlank String supportingOutcomeId,
      @NotBlank String title,
      @NotBlank String parentOutcomeTitle,
      @NotBlank String parentDOTitle,
      String metricStatement) {}

  public record AlternativeOutcomeDto(
      @NotBlank String supportingOutcomeId, @NotBlank String title) {}

  public record QualityLintRequest(
      @NotBlank String commitId,
      @NotBlank @Size(min = 5, max = 280) String commitText,
      @NotBlank String category,
      @NotBlank String priority,
      @NotBlank String supportingOutcomeTitle) {}

  // ---------- Response DTO ----------

  public record AIInsightDto(
      String id, String kind, String model, JsonNode payload, int latencyMs, String costCents) {

    static AIInsightDto from(AIInsight insight) {
      JsonNode parsed;
      try {
        parsed = MAPPER.readTree(insight.getPayloadJson());
      } catch (JsonProcessingException e) {
        parsed = MAPPER.createObjectNode();
      }
      return new AIInsightDto(
          insight.getId(),
          insight.getKind().name(),
          insight.getModel(),
          parsed,
          insight.getLatencyMs(),
          insight.getCostCents().toPlainString());
    }
  }
}
