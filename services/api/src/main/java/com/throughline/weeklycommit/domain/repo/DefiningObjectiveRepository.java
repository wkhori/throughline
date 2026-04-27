package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.DefiningObjective;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DefiningObjectiveRepository extends JpaRepository<DefiningObjective, String> {
  List<DefiningObjective> findAllByRallyCryIdInAndArchivedAtIsNullOrderByDisplayOrderAsc(
      List<String> rallyCryIds);

  long countByRallyCryIdAndArchivedAtIsNull(String rallyCryId);
}
