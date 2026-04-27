# --- build stage ---
# Build context = repo root (Railway uploads from CWD = repo root). The gradle project paths
# stay scoped to services/api/ so this Dockerfile is self-consistent regardless of where
# `docker build` is run from, as long as the context is the repo root.
FROM eclipse-temurin:21-jdk AS builder
WORKDIR /workspace
COPY services/api/gradle gradle
COPY services/api/gradlew services/api/settings.gradle.kts services/api/build.gradle.kts ./
COPY services/api/config config
RUN chmod +x gradlew
COPY services/api/src src
RUN ./gradlew bootJar -x test --no-daemon

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
