# Sandbox image for running tracer-instrumented Go solutions.
#
# This image provides only the toolchain, the vendored tracer SDK, and the
# compile+run entrypoint. The runtime isolation flags (--network none,
# --memory 256m, --read-only, non-root, wall-clock kill) are applied by the
# server per PRD §8.2 — NOT here.
#
# Build from the repo root:
#   docker build -f docker/go.Dockerfile -t dsa-run-go:0.1.0 .
FROM golang:1.22-alpine

# Vendored tracer SDK so `import "dsaviz/tracer"` resolves with no network access.
COPY packages/tracer-go /opt/dsaviz
# Warm a build cache (stdlib + tracer) into /opt/gocache so runtime compiles seed
# from it instead of recompiling the stdlib cold every run (15s -> ~2s). This also
# sanity-compiles the SDK + example, failing the build if either is broken.
RUN cd /opt/dsaviz \
    && GOCACHE=/opt/gocache go build -o /tmp/warm ./examples/bubblesort \
    && rm -f /tmp/warm \
    && GOCACHE=/opt/gocache go build -o /usr/local/bin/dsaviz-rewrite ./cmd/rewrite \
    && chmod -R a+rX /opt/gocache

# Compile + run entrypoint.
COPY docker/scripts/run.sh /usr/local/bin/run.sh
RUN chmod +x /usr/local/bin/run.sh

# Non-root runtime user.
RUN adduser -D -u 10001 runner

# Offline builds; all writable state under the tmpfs /tmp (rootfs is read-only at runtime).
ENV GOPROXY=off \
    GOFLAGS=-mod=mod \
    GO111MODULE=on \
    CGO_ENABLED=0 \
    GOCACHE=/tmp/gocache \
    GOPATH=/tmp/gopath \
    HOME=/tmp

USER runner
ENTRYPOINT ["/usr/local/bin/run.sh"]
