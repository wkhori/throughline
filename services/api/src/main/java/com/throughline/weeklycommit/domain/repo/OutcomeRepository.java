package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.Outcome;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OutcomeRepository extends JpaRepository<Outcome, String> {
  List<Outcome> findAllByDefiningObjectiveIdInAndArchivedAtIsNullOrderByDisplayOrderAsc(
      List<String> dos);
}
