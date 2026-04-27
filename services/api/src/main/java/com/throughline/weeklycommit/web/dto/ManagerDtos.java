package com.throughline.weeklycommit.web.dto;

import java.time.Instant;
import java.time.LocalDate;

/** DTOs for the Phase-4 manager surface. */
public final class ManagerDtos {
  private ManagerDtos() {}

  /**
   * One row in {@code GET /manager/team-rollup}. {@code payload} is the deserialised JSONB blob.
   */
  public record TeamRollupRow(
      String teamId, LocalDate weekStart, Object payload, Instant computedAt) {}

  /** {@code GET /manager/digest/current}. Phase 4 always returns {@code digest=null}. */
  public record DigestEnvelope(Object digest, String state) {}

  /** {@code POST /manager/digest/regenerate}. Phase 4 returns 202 with a queued state. */
  public record DigestRegenerateResponse(Object digest, String state, String message) {}
}
