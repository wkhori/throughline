# --- build stage ---
# Build context is `services/api/` — the gradle project is self-contained.
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /workspace
COPY gradle gradle
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY config config
RUN chmod +x gradlew
COPY src src
RUN --mount=type=cache,target=/root/.gradle ./gradlew bootJar -x test --no-daemon

# --- runtime stage ---
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app
RUN useradd --create-home --shell /bin/bash app
COPY --from=builder /workspace/build/libs/*.jar /app/app.jar
USER app
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-8080}/actuator/health/readiness || exit 1
ENTRYPOINT ["sh","-c","java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar /app/app.jar"]
