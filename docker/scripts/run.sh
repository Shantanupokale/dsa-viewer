#!/bin/sh
# Compile and run a tracer-instrumented Go program inside the sandbox.
#
# The server mounts a job directory read-only at /job containing:
#   main.go    the user's solution
#   go.mod     module `run` with `replace dsaviz => /opt/dsaviz`
#   input.txt  raw stdin for the program
#
# Exit codes: 20 = compilation failed; otherwise the program's own exit code.
# The rootfs is read-only, so all writes go to the tmpfs at /tmp.
set -eu

BUILD=/tmp/build
mkdir -p "$BUILD"
cp /job/main.go /job/go.mod "$BUILD/"

# Seed the writable tmpfs build cache from the image-baked warm cache. Recompiling
# the stdlib cold would blow the wall-clock budget; a memory copy is ~1s.
cp -a /opt/gocache /tmp/gocache 2>/dev/null || true

cd "$BUILD"

if ! go build -o /tmp/prog . 2>/tmp/compile.err; then
  echo "__COMPILE_FAILED__" >&2
  cat /tmp/compile.err >&2
  exit 20
fi

exec /tmp/prog < /job/input.txt
