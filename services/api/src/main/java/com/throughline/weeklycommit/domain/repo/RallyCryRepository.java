package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.RallyCry;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RallyCryRepository extends JpaRepository<RallyCry, String> {
  List<RallyCry> findAllByOrgIdAndArchivedAtIsNullOrderByDisplayOrderAsc(String orgId);

  Optional<RallyCry> findByOrgIdAndTitleAndArchivedAtIsNull(String orgId, String title);
}
