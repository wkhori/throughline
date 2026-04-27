package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitState;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CommitRepository extends JpaRepository<Commit, String> {
  List<Commit> findAllByWeekIdOrderByDisplayOrderAsc(String weekId);

  long countByWeekId(String weekId);

  long countByWeekIdAndStateNot(String weekId, CommitState state);

  /**
   * All commits owned by users on a given team for a given week-start. Used by {@code
   * MaterializedRollupJob} to compute per-team rollup payload without N+1 round-trips.
   */
  @Query(
      "select c from Commit c, Week w, User u where c.weekId = w.id and w.userId = u.id and"
          + " u.teamId = :teamId and w.weekStart = :weekStart")
  List<Commit> findAllByTeamAndWeekStart(
      @Param("teamId") String teamId, @Param("weekStart") LocalDate weekStart);

  /** Counts commits whose week_start is in the supplied range, scoped to the team. */
  @Query(
      "select count(c) from Commit c, Week w, User u where c.weekId = w.id and w.userId = u.id and"
          + " u.teamId = :teamId and w.weekStart >= :fromDate and w.weekStart <= :toDate and"
          + " c.supportingOutcomeId = :soId")
  long countByTeamAndSupportingOutcomeBetweenWeeks(
      @Param("teamId") String teamId,
      @Param("soId") String supportingOutcomeId,
      @Param("fromDate") LocalDate fromDate,
      @Param("toDate") LocalDate toDate);
}
