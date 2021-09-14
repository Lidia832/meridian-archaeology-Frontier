/* stats.h - ingest run statistics and reporting.
 *
 * Pulls together the numbers a collector run produces so they can be
 * printed once at the end (and, for mrd_replay, reconstructed from the
 * store).  Two layers:
 *   - a per-channel accumulator (count, min, max, running mean) so we
 *     can say what a season looked like without a second pass, and
 *   - a run-level roll-up that also owns the QC counters, the station
 *     tally and the frame-level accept/reject counts.
 *
 * S. Bauer, 2021-10.
 */
#ifndef MERIDIAN_STATS_H
#define MERIDIAN_STATS_H

#include <stdio.h>
#include "decode.h"
#include "validate.h"
#include "registry.h"

/* Streaming accumulator for one channel. */
struct mrd_accum {
    long   n;
    double min;
    double max;
    double sum;
    double mean;            /* Welford running mean                    */
    double m2;              /* Welford sum of squares of differences   */
};

void   mrd_accum_init(struct mrd_accum *a);
void   mrd_accum_add(struct mrd_accum *a, double x);
double mrd_accum_mean(const struct mrd_accum *a);
double mrd_accum_variance(const struct mrd_accum *a); /* sample variance */
double mrd_accum_stddev(const struct mrd_accum *a);

/* Whole-run statistics. */
struct mrd_run_stats {
    /* frame-level */
    long frames_seen;       /* frames pulled off the spool             */
    long parsed_ok;         /* frames that parsed (magic + crc)        */
    long parse_err;         /* frames rejected by the parser           */
    long bad_magic;         /* subset: wrong magic                     */
    long bad_crc;           /* subset: crc mismatch                    */
    long stored;            /* readings written to the store           */

    /* per-channel accumulators, indexed by enum mrd_channel */
    struct mrd_accum ch[MRD_MAX_CHANNELS];

    /* embedded roll-ups */
    struct mrd_qc_counters   qc;
    struct mrd_registry_seen stations;
};

void mrd_run_stats_init(struct mrd_run_stats *r);

/* Fold one successfully decoded+validated reading into the run stats.
 * Updates the channel accumulators, the QC counters (via the supplied
 * result) and the station tally. */
void mrd_run_stats_add(struct mrd_run_stats *r,
                       const struct mrd_decoded *d,
                       const struct mrd_qc_result *qc);

/* Record a parser rejection.  parse_rc is the negative code from
 * mrd_packet_parse so we can attribute magic vs crc failures. */
void mrd_run_stats_reject(struct mrd_run_stats *r, int parse_rc);

/* Print the full run report to fp. */
void mrd_run_stats_report(const struct mrd_run_stats *r, FILE *fp);

#endif
