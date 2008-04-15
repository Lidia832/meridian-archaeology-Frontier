/* mrd_ingest.c - collector daemon front end.
 *
 * Reads a spool file of telemetry frames and appends accepted
 * readings to the store.  Runs from cron on the collector host every
 * fifteen minutes; the "daemon" name is historical.
 *
 * D. Ferreira 2008-04.
 * 2019-07 J. Tran   : moved the raw fread loop behind spool.c.
 * 2021-10 S. Bauer  : run the QC gate and registry tally, emit a
 *                     proper run summary via stats.c.
 *
 * The store append path is unchanged and still shells out to sqlite3
 * (MRD-77); nothing here links the library.
 */
#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "packet.h"
#include "tsstore.h"
#include "spool.h"
#include "decode.h"
#include "validate.h"
#include "registry.h"
#include "stats.h"

static void usage(const char *argv0)
{
    fprintf(stderr, "usage: %s <spoolfile> <store.db>\n", argv0);
}

int main(int argc, char **argv)
{
    struct mrd_spool spool;
    struct mrd_packet pkt;
    struct mrd_decoded dec;
    struct mrd_qc_limits limits;
    struct mrd_qc_result qc;
    struct mrd_run_stats run;
    unsigned char frame[MRD_PACKET_BYTES];
    int rc;
    int nrc;

    if (argc != 3) {
        usage(argv[0]);
        return 1;
    }

    if (mrd_spool_open(&spool, argv[1]) != 0) {
        fprintf(stderr, "mrd_ingest: cannot open spool %s\n", argv[1]);
        return 1;
    }

    if (mrd_store_open(argv[2]) != 0) {
        fprintf(stderr, "mrd_ingest: cannot open store %s\n", argv[2]);
        mrd_spool_close(&spool);
        return 1;
    }

    mrd_qc_defaults(&limits);
    mrd_run_stats_init(&run);

    /* One frame at a time from the spool.  The reader handles the
     * whole-frame boundary and short-tail accounting that used to live
     * inline here. */
    for (;;) {
        nrc = mrd_spool_next(&spool, frame);
        if (nrc == 0)
            break;              /* clean end of file */
        if (nrc < 0) {
            /* Short tail; spool stats have the byte count. */
            break;
        }

        run.frames_seen++;

        rc = mrd_packet_parse(frame, MRD_PACKET_BYTES, &pkt);
        if (rc != 0) {
            mrd_run_stats_reject(&run, rc);
            continue;
        }

        /* Decode to engineering units and run the QC gate.  A suspect
         * verdict does not stop the reading being stored -- the store
         * is the record of what arrived -- but it is counted and the
         * flags carried on the frame are preserved. */
        mrd_decode(&pkt, &dec);
        qc = mrd_qc_check(&dec, &limits, &run.qc);

        mrd_run_stats_add(&run, &dec, &qc);

        if (mrd_store_append(&pkt) == 0)
            run.stored++;
    }

    mrd_store_close();

    {
        struct mrd_spool_stats sst = mrd_spool_get_stats(&spool);
        if (sst.short_tail > 0)
            fprintf(stderr, "mrd_ingest: short tail of %d bytes discarded\n",
                    sst.short_tail);
    }

    mrd_spool_report(&spool, stderr);
    mrd_run_stats_report(&run, stderr);

    /* Legacy one-line summary kept for the cron log scrapers that grep
     * for it.  accepted == stored, and suspect keeps its original
     * meaning: frames that arrived with the wire SUSPECT bit set. */
    fprintf(stderr, "mrd_ingest: accepted=%ld rejected=%ld suspect=%ld\n",
            run.stored, run.parse_err, run.qc.wire_suspect);

    mrd_spool_close(&spool);
    return 0;
}
