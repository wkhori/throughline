package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.TeamRollupCache;
import com.throughline.weeklycommit.domain.TeamRollupCache.TeamRollupCacheId;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamRollupCacheRepository
    extends JpaRepository<TeamRollupCache, TeamRollupCacheId> {

  /** Latest cache row per team across the org for a given week — primary read for the dashboard. */
  @Query(
      "select c from TeamRollupCache c where c.id.weekStart = :weekStart and c.id.teamId in"
          + " :teamIds")
  Page<TeamRollupCache> findByTeamIdsForWeek(
      @Param("teamIds") List<String> teamIds,
      @Param("weekStart") LocalDate weekStart,
      Pageable pageable);

  Optional<TeamRollupCache> findByIdTeamIdAndIdWeekStart(String teamId, LocalDate weekStart);
}
