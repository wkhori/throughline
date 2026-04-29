package com.throughline.weeklycommit.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.ai.AiCopilotService;
import com.throughline.weeklycommit.application.ai.AlignmentDeltaService;
import com.throughline.weeklycommit.application.ai.PortfolioReviewService;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.infrastructure.security.ManagerScope;
import com.throughline.weeklycommit.web.error.NotFoundException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
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
  private final PortfolioReviewService portfolioReviewService;
  private final AlignmentDeltaService alignmentDeltaService;
  private final WeekRepository weekRepository;
  private final ManagerScope managerScope;
  private final CurrentUserResolver currentUser;

  public AiCopilotController(
      AiCopilotService aiService,
      PortfolioReviewService portfolioReviewService,
      AlignmentDeltaService alignmentDeltaService,
      WeekRepository weekRepository,
      ManagerScope managerScope,
      CurrentUserResolver currentUser) {
    this.aiService = aiService;
    this.portfolioReviewService = portfolioReviewService;
    this.alignmentDeltaService = alignmentDeltaService;
    this.weekRepository = weekRepository;
    this.managerScope = managerScope;
    this.currentUser = currentUser;
  }

  /**
   * P15: latest T3 portfolio review for a week. Scope-checked — caller must be the week's owner or
   * a manager who can see them.
   */
  @org.springframework.web.bind.annotation.GetMapping("/portfolio-review/{weekId}")
  public ResponseEntity<AIInsightDto> getPortfolioReview(
      @org.springframework.web.bind.annotation.PathVariable String weekId) {
    requireWeekScope(weekId);
    return portfolioReviewService
        .findLatestForWeek(weekId)
        .map(i -> ResponseEntity.ok(AIInsightDto.from(i)))
        .orElseGet(() -> ResponseEntity.status(HttpStatus.NO_CONTENT).build());
  }

  /** Synchronous retry — runs T3 (or fallback) and returns the persisted insight. */
  @PostMapping("/portfolio-review/{weekId}")
  public ResponseEntity<AIInsightDto> runPortfolioReview(
      @org.springframework.web.bind.annotation.PathVariable String weekId) {
    Week week = requireWeekScope(weekId);
    User u = currentUser.requireCurrentUser();
    AIInsight insight =
        portfolioReviewService.runReview(week.getId(), week.getUserId(), week.getOrgId());
    if (insight != null && !insight.getOrgId().equals(u.getOrgId())) {
      throw new AccessDeniedException("cross-org access blocked");
    }
    return ResponseEntity.ok(AIInsightDto.from(insight));
  }

  /** P15: latest T4 alignment delta for a reconciled week. Same scope rule as T3. */
  @org.springframework.web.bind.annotation.GetMapping("/alignment-delta/{weekId}")
  public ResponseEntity<AIInsightDto> getAlignmentDelta(
      @org.springframework.web.bind.annotation.PathVariable String weekId) {
    requireWeekScope(weekId);
    return alignmentDeltaService
        .findLatestForWeek(weekId)
        .map(i -> ResponseEntity.ok(AIInsightDto.from(i)))
        .orElseGet(() -> ResponseEntity.status(HttpStatus.NO_CONTENT).build());
  }

  /** Synchronous retry of T4 — used by the FE retry button when the AFTER_COMMIT consumer fails. */
  @PostMapping("/alignment-delta/{weekId}")
  public ResponseEntity<AIInsightDto> runAlignmentDelta(
      @org.springframework.web.bind.annotation.PathVariable String weekId) {
    Week week = requireWeekScope(weekId);
    AIInsight insight =
        alignmentDeltaService.runDelta(week.getId(), week.getUserId(), week.getOrgId());
    return ResponseEntity.ok(AIInsightDto.from(insight));
  }

  private Week requireWeekScope(String weekId) {
    Week week =
        weekRepository.findById(weekId).orElseThrow(() -> new NotFoundException("Week", weekId));
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (!managerScope.canSee(week.getUserId(), auth)) {
      throw new AccessDeniedException("not authorized to view this week's AI insight");
    }
    return week;
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
      @NotNull @Size(min = 1, max = 250) List<CandidateDto> candidates,
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
