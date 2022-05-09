# Meridian course environment — CIS*3250 Software Design III, University of Guelph.
#
# One pinned toolchain for everyone. The base is fixed to Ubuntu 24.04 so the
# compilers (and the build-flag behaviour the codebase deliberately depends on)
# are identical on Intel and Apple Silicon machines and in the cloud. Getting
# Meridian to run is not a course objective; this image removes that step.
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ENV DEBIAN_FRONTEND=noninteractive

# The whole stack, and nothing more:
#   build-essential  -> gcc, make          (C collector; top-level build)
#   gfortran         -> the numerical core  (FORTRAN 77 + F90)
#   default-jdk      -> javac + java        (Java service layer; ships JDK 21)
#   nodejs           -> the console's static server
#   python3          -> the analytics/orchestration layer (standard library only)
#   sqlite3          -> the CLI both the C and Java layers shell out to at runtime
# git comes with the base image and is needed for the history exercises.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gfortran \
        default-jdk \
        nodejs \
        python3 \
        sqlite3 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 8080 8081
