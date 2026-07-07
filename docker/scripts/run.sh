#!/bin/sh
# Compile and run a tracer-instrumented Go program inside the sandbox.
#
# The server mounts a job directory read-only at /job containing:
#   main.go     the user's solution
#   go.mod      module `run` with `replace dsaviz => /opt/dsaviz`
#   input.txt   raw stdin for the program
#   instrument  (optional, empty marker) — auto-instrument raw code via AST rewrite
#
# When instrumenting, the rewritten source is emitted to stdout as one line:
#   @INSTRUMENTED@<base64>
# which the server strips out (like @TRACE@ lines) and returns to the client.
#
# Exit codes: 20 = compilation (or rewrite) failed; otherwise the program's exit code.
# The rootfs is read-only, so all writes go to the tmpfs at /tmp.
set -eu

BUILD=/tmp/build
mkdir -p "$BUILD"
cp /job/main.go /job/go.mod "$BUILD/"

# Seed the writable tmpfs build cache from the image-baked warm cache. Recompiling
# the stdlib cold would blow the wall-clock budget; a memory copy is ~1s.
cp -a /opt/gocache /tmp/gocache 2>/dev/null || true

cd "$BUILD"

if [ -f /job/instrument ]; then
  if ! dsaviz-rewrite main.go > main_rw.go 2>/tmp/rewrite.err; then
    echo "__COMPILE_FAILED__" >&2
    cat /tmp/rewrite.err >&2
    exit 20
  fi
  mv main_rw.go main.go
  echo "@INSTRUMENTED@$(base64 < main.go | tr -d '\n')"
fi

if ! go build -o /tmp/prog . 2>/tmp/compile.err; then
  echo "__COMPILE_FAILED__" >&2
  cat /tmp/compile.err >&2
  exit 20
fi

exec /tmp/prog < /job/input.txt
