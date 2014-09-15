#!/bin/sh
# Build the service layer. No dependencies: the JDK HTTP server is
# all that is left of the 2014 Spring application.
set -e
cd "$(dirname "$0")"
mkdir -p build/classes
javac -d build/classes $(find src -name '*.java')
echo "built services/build/classes"
