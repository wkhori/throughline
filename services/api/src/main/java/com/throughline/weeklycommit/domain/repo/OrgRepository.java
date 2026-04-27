package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.Org;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrgRepository extends JpaRepository<Org, String> {}
