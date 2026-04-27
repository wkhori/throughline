package com.throughline.weeklycommit;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Base for full-stack tests that need a real Postgres + Flyway-managed schema.
 *
 * <p>Patch P30: connects to a long-running Postgres (docker-compose locally; GitHub Actions {@code
 * services: postgres} in CI) rather than spinning up Testcontainers, because Docker Desktop on
 * macOS requires Docker API ≥1.44 and the bundled {@code docker-java} in current Testcontainers
 * releases negotiates v1.32. Datasource defaults from {@code application.yml} — {@code
 * jdbc:postgresql://localhost:5432/throughline / throughline / throughline} — match both {@code
 * docker-compose.yml} and the CI service container.
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class PostgresIntegrationTestBase {}
