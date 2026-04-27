package com.throughline.weeklycommit.infrastructure;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * UTC system clock as a bean. Inject {@link Clock} instead of calling {@link
 * java.time.Instant#now()} directly so tests can swap in a fixed clock.
 */
@Configuration
public class ClockConfig {
  @Bean
  public Clock systemClock() {
    return Clock.systemUTC();
  }
}
