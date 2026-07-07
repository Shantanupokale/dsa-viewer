#!/bin/sh
# Compile and run a tracer-instrumented Java program in the sandbox.
#
# Mounted read-only at /job: Main.java (user's solution, public class Main), input.txt.
# The tracer SDK is pre-compiled into /opt/tracer-java/classes at image build.
# Exit codes: 20 = compilation failed; otherwise the program's own exit code.
set -eu

BUILD=/tmp/build
mkdir -p "$BUILD"
cp /job/Main.java "$BUILD/"
cd "$BUILD"

if ! javac -cp /opt/tracer-java/classes -d "$BUILD" Main.java 2>/tmp/compile.err; then
  echo "__COMPILE_FAILED__" >&2
  cat /tmp/compile.err >&2
  exit 20
fi

exec java -XX:-UsePerfData -cp "$BUILD:/opt/tracer-java/classes" Main < /job/input.txt
