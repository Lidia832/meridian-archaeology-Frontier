/* spool.h - spool file reader abstraction.
 *
 * The original mrd_ingest.c read the spool with a raw fread loop and a
 * hand-computed "whole frame multiple" chunk size, and every tool that
 * wanted to read a spool copied that loop.  This wraps it: open a
 * spool, pull one frame at a time, and get honest stats at the end
 * (how many frames, how many bytes, whether the file ended on a frame
 * boundary or left a short tail).  The wire format is still owned by
 * packet.c; this only deals in whole MRD_PACKET_BYTES-sized frames.
 *
 * J. Tran, 2019-07.
 */
#ifndef MERIDIAN_SPOOL_H
#define MERIDIAN_SPOOL_H

#include <stdio.h>
#include "packet.h"

struct mrd_spool_stats {
    long frames_read;       /* whole frames handed out                */
    long bytes_read;        /* total bytes consumed from the file     */
    int  short_tail;        /* bytes in a trailing partial frame      */
    int  eof;               /* set once the file is exhausted         */
};

struct mrd_spool {
    FILE *fp;
    int   owns_fp;          /* close fp on mrd_spool_close if set     */
    unsigned char frame[MRD_PACKET_BYTES];
    struct mrd_spool_stats st;
};

/* Open a spool file by path.  Returns 0 on success, -1 on failure. */
int mrd_spool_open(struct mrd_spool *s, const char *path);

/* Wrap an already-open stream (does not take ownership). */
int mrd_spool_wrap(struct mrd_spool *s, FILE *fp);

/* Read the next whole frame into out (must hold MRD_PACKET_BYTES).
 * Returns 1 when a frame was read, 0 at clean end of file, and -1 when
 * the file ended mid-frame (the short-tail byte count is recorded in
 * the stats and out is left untouched). */
int mrd_spool_next(struct mrd_spool *s, unsigned char *out);

/* A copy of the running stats. */
struct mrd_spool_stats mrd_spool_get_stats(const struct mrd_spool *s);

/* Close the spool, releasing the stream if we own it.  Safe to call
 * more than once. */
int mrd_spool_close(struct mrd_spool *s);

/* Print the spool stats to fp. */
void mrd_spool_report(const struct mrd_spool *s, FILE *fp);

#endif
