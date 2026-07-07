# Sandbox image for running tracer-instrumented C++ solutions.
#
# The official `gcc` image has no reliable alpine tag, so we use alpine + g++.
# Isolation flags (--network none, caps, read-only, non-root, timeout) are applied by
# the server per PRD §8.2 — not here.
#
# Build from the repo root:
#   docker build -f docker/cpp.Dockerfile -t dsa-run-cpp:0.1.0 .
FROM alpine:3.20

RUN apk add --no-cache g++

# Header-only tracer SDK (compilation needs no network; -I /opt/tracer-cpp).
COPY packages/tracer-cpp /opt/tracer-cpp

# Compile + run entrypoint.
COPY docker/scripts/run-cpp.sh /usr/local/bin/run.sh
RUN chmod +x /usr/local/bin/run.sh

# Non-root runtime user.
RUN adduser -D -u 10001 runner

USER runner
ENTRYPOINT ["/usr/local/bin/run.sh"]
