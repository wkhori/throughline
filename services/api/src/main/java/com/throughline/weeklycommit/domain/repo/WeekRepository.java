package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.Week;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeekRepository extends JpaRepository<Week, String> {
  Optional<Week> findByUserIdAndWeekStart(String userId, LocalDate weekStart);
}
