#!/bin/sh
# Compile and run a tracer-instrumented C++ program in the sandbox.
#
# Mounted read-only at /job: main.cpp (user's solution), input.txt.
# The header-only tracer is at /opt/tracer-cpp (user does #include "tracer.hpp").
# Exit codes: 20 = compilation failed; otherwise the program's own exit code.
set -eu

BUILD=/tmp/build
mkdir -p "$BUILD"
cp /job/main.cpp "$BUILD/"
cd "$BUILD"

if ! g++ -O2 -std=c++17 -I /opt/tracer-cpp -o /tmp/prog main.cpp 2>/tmp/compile.err; then
  echo "__COMPILE_FAILED__" >&2
  cat /tmp/compile.err >&2
  exit 20
fi

exec /tmp/prog < /job/input.txt
