package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.TeamPriorityWeight;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamPriorityWeightRepository extends JpaRepository<TeamPriorityWeight, String> {
  List<TeamPriorityWeight> findAllByTeamId(String teamId);
}
