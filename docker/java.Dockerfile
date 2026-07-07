# Sandbox image for running tracer-instrumented Java solutions.
#
# Isolation flags (--network none, memory/cpu/pids caps, read-only, non-root, timeout)
# are applied by the server per PRD §8.2 — not here.
#
# Build from the repo root:
#   docker build -f docker/java.Dockerfile -t dsa-run-java:0.1.0 .
FROM eclipse-temurin:21-jdk-alpine

# Vendored tracer SDK sources, pre-compiled so runtime only compiles the user's Main.java.
COPY packages/tracer-java /opt/tracer-java
RUN mkdir -p /opt/tracer-java/classes \
    && javac -d /opt/tracer-java/classes /opt/tracer-java/dsaviz/*.java

# Compile + run entrypoint.
COPY docker/scripts/run-java.sh /usr/local/bin/run.sh
RUN chmod +x /usr/local/bin/run.sh

# Non-root runtime user.
RUN adduser -D -u 10001 runner

# All writable state under the tmpfs /tmp (rootfs is read-only at runtime).
# java.io.tmpdir already defaults to /tmp; avoid JAVA_TOOL_OPTIONS so the JVM's
# "Picked up JAVA_TOOL_OPTIONS" notice doesn't pollute captured stderr.
ENV HOME=/tmp

USER runner
ENTRYPOINT ["/usr/local/bin/run.sh"]
