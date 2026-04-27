package com.throughline.weeklycommit;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Clears tables in FK-safe order between tests. Avoids the self-FK on {@code app_user.manager_id}
 * blocking {@code deleteAll()}.
 */
@Component
public class TestDatabaseCleaner {

  @PersistenceContext private EntityManager em;

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void clean() {
    // Self-FK on commit.parent_commit_id and app_user.manager_id need to be nulled before delete.
    // V5: clear the manager rollup cache before tearing down team rows.
    em.createNativeQuery("DELETE FROM team_rollup_cache").executeUpdate();
    em.createNativeQuery("UPDATE \"commit\" SET parent_commit_id = NULL").executeUpdate();
    em.createNativeQuery("DELETE FROM \"commit\"").executeUpdate();
    em.createNativeQuery("DELETE FROM week").executeUpdate();
    em.createNativeQuery("UPDATE app_user SET manager_id = NULL").executeUpdate();
    em.createNativeQuery("UPDATE team SET manager_id = NULL").executeUpdate();
    em.createNativeQuery("DELETE FROM team_priority_weight").executeUpdate();
    em.createNativeQuery("DELETE FROM supporting_outcome").executeUpdate();
    em.createNativeQuery("DELETE FROM outcome").executeUpdate();
    em.createNativeQuery("DELETE FROM defining_objective").executeUpdate();
    em.createNativeQuery("DELETE FROM rally_cry").executeUpdate();
    em.createNativeQuery("DELETE FROM app_user").executeUpdate();
    em.createNativeQuery("DELETE FROM team").executeUpdate();
    em.createNativeQuery("DELETE FROM org").executeUpdate();
  }
}
