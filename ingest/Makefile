CC      = gcc
CFLAGS  = -O2 -Wall -std=gnu99
LDLIBS  = -lm

# Shared collector objects (everything except the two tool main()s).
COMMON  = src/packet.o src/tsstore.o src/decode.o src/validate.o \
          src/registry.o src/spool.o src/stats.o

# Per-tool entry points.
INGEST_OBJ = src/mrd_ingest.o $(COMMON)
REPLAY_OBJ = src/mrd_replay.o $(COMMON)

BINS    = mrd_ingest mrd_replay

all: $(BINS)

mrd_ingest: $(INGEST_OBJ)
	$(CC) $(CFLAGS) -o $@ $(INGEST_OBJ) $(LDLIBS)

mrd_replay: $(REPLAY_OBJ)
	$(CC) $(CFLAGS) -o $@ $(REPLAY_OBJ) $(LDLIBS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# Header dependencies (kept explicit; the collector is small enough
# that a full dependency generator is not worth the make magic).
src/packet.o:    src/packet.c   src/packet.h
src/tsstore.o:   src/tsstore.c  src/tsstore.h  src/packet.h
src/decode.o:    src/decode.c   src/decode.h   src/packet.h
src/validate.o:  src/validate.c src/validate.h src/decode.h src/packet.h
src/registry.o:  src/registry.c src/registry.h src/packet.h
src/spool.o:     src/spool.c    src/spool.h    src/packet.h
src/stats.o:     src/stats.c    src/stats.h    src/decode.h src/validate.h src/registry.h
src/mrd_ingest.o: src/mrd_ingest.c src/packet.h src/tsstore.h src/spool.h \
                  src/decode.h src/validate.h src/registry.h src/stats.h
src/mrd_replay.o: src/mrd_replay.c src/packet.h src/registry.h src/stats.h

test: all
	sh test/test_ingest.sh

clean:
	rm -f src/*.o $(BINS)

.PHONY: all clean test
