package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.AIUserHourCounter;
import com.throughline.weeklycommit.domain.AIUserHourCounter.AIUserHourCounterId;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * CRUD on the per-user-per-hour audit table (P23). The atomic INSERT … ON CONFLICT DO UPDATE …
 * RETURNING increment lives in {@code AnthropicCostGuard} via {@code EntityManager} so the
 * cap-check stays on a single round trip — see PRD §6.3.
 */
public interface AIUserHourCounterRepository
    extends JpaRepository<AIUserHourCounter, AIUserHourCounterId> {}
