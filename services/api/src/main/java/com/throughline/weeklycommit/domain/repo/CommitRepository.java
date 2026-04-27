package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitState;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommitRepository extends JpaRepository<Commit, String> {
  List<Commit> findAllByWeekIdOrderByDisplayOrderAsc(String weekId);

  long countByWeekId(String weekId);

  long countByWeekIdAndStateNot(String weekId, CommitState state);
}
