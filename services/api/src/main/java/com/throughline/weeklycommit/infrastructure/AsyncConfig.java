package com.throughline.weeklycommit.infrastructure;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Async + scheduling support. Two named executors:
 *
 * <ul>
 *   <li>{@code notificationExecutor} — Phase 5b/5c AFTER_COMMIT consumers (T3 / T4 / digests /
 *       alignment-risk scans). Bounded so a stuck Anthropic call cannot exhaust the JVM's thread
 *       pool.
 * </ul>
 *
 * <p>Gated to {@code !test} so test runs invoke {@code @Async} methods synchronously on the calling
 * thread — keeping AFTER_COMMIT consumers deterministic in test contexts and avoiding cleanup races
 * against {@code ai_user_hour_counter} FK.
 */
@Configuration
@Profile("!test")
@EnableAsync
@EnableScheduling
public class AsyncConfig {

  @Bean(name = "notificationExecutor")
  public Executor notificationExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(8);
    executor.setQueueCapacity(64);
    executor.setThreadNamePrefix("notif-");
    executor.setAwaitTerminationSeconds(20);
    executor.setWaitForTasksToCompleteOnShutdown(true);
    executor.initialize();
    return executor;
  }
}
