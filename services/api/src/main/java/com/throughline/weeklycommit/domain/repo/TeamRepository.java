package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.Team;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<Team, String> {}
