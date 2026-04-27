package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.SupportingOutcome;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportingOutcomeRepository extends JpaRepository<SupportingOutcome, String> {
  List<SupportingOutcome> findAllByOutcomeIdInAndArchivedAtIsNullOrderByDisplayOrderAsc(
      List<String> outcomeIds);
}
