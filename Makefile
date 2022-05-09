# Meridian top level build.
# There is no single build system. Each component is built with
# whatever its team used at the time. This Makefile just calls them
# in the right order.

.PHONY: all model ingest services dashboard clean run

all: model ingest services

model:
	$(MAKE) -C model

ingest:
	$(MAKE) -C ingest

services:
	./services/build.sh

dashboard:
	@echo "dashboard has no build step, see MRD-181"

clean:
	$(MAKE) -C model clean
	$(MAKE) -C ingest clean
	rm -rf services/build

run: all
	./run.sh
