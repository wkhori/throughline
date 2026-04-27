package com.throughline.weeklycommit.infrastructure.ai;

import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 60-second dedupe by {@code inputHash} (P13). On cache-hit, we persist a NEW {@link AIInsight} row
 * tagged {@code model='cache:<original>'} with {@code costCents=0} so the audit trail captures the
 * dedup; the org budget is NOT incremented (P13). The hit's payload is reused verbatim.
 */
@Component
public class AIInsightCache {

  private final AIInsightRepository insightRepository;
  private final Clock clock;
  private final long ttlSeconds;

  public AIInsightCache(
      AIInsightRepository insightRepository,
      Clock clock,
      @Value("${anthropic.cache.insight-ttl-seconds:60}") long ttlSeconds) {
    this.insightRepository = insightRepository;
    this.clock = clock;
    this.ttlSeconds = ttlSeconds;
  }

  /** Return a fresh insight matching {@code (kind, inputHash)} within the TTL window, or empty. */
  @Transactional(readOnly = true)
  public Optional<AIInsight> findFresh(AIInsightKind kind, String inputHash) {
    Instant since = clock.instant().minus(Duration.ofSeconds(ttlSeconds));
    return insightRepository.findFreshByInputHash(inputHash, kind, since);
  }
}
