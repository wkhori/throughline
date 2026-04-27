package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, String> {
  Optional<User> findByAuth0Sub(String auth0Sub);
}
