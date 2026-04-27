package com.throughline.weeklycommit;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
@EnableScheduling
public class WeeklyCommitApplication {
  public static void main(String[] args) {
    SpringApplication.run(WeeklyCommitApplication.class, args);
  }
}
