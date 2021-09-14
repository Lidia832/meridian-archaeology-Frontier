/* stats.c - ingest run statistics and reporting.
 *
 * S. Bauer, 2021-10.
 *
 * The per-channel mean/variance use Welford's method so a full season
 * (six stations x ~174 days) folds in one pass with no overflow and no
 * second read of the store.  The frame-level counters mirror what
 * mrd_packet_parse can tell us: it returns -2 for a bad magic and -3
 * for a crc mismatch, so we can split parse_err into those buckets
 * without re-inspecting the frame.  If the parser ever grows new
 * negative codes, extend mrd_run_stats_reject to match.
 */
#define _POSIX_C_SOURCE 200809L

#include <string.h>
#include <math.h>
#include <float.h>
#include "stats.h"

void mrd_accum_init(struct mrd_accum *a)
{
    if (a == NULL)
        return;
    a->n = 0;
    a->min = DBL_MAX;
    a->max = -DBL_MAX;
    a->sum = 0.0;
    a->mean = 0.0;
    a->m2 = 0.0;
}

void mrd_accum_add(struct mrd_accum *a, double x)
{
    double delta, delta2;

    if (a == NULL)
        return;

    a->n++;
    a->sum += x;
    if (x < a->min)
        a->min = x;
    if (x > a->max)
        a->max = x;

    /* Welford online update. */
    delta = x - a->mean;
    a->mean += delta / (double)a->n;
    delta2 = x - a->mean;
    a->m2 += delta * delta2;
}

double mrd_accum_mean(const struct mrd_accum *a)
{
    if (a == NULL || a->n == 0)
        return 0.0;
    return a->mean;
}

double mrd_accum_variance(const struct mrd_accum *a)
{
    if (a == NULL || a->n < 2)
        return 0.0;
    return a->m2 / (double)(a->n - 1);
}

double mrd_accum_stddev(const struct mrd_accum *a)
{
    double v = mrd_accum_variance(a);
    return v > 0.0 ? sqrt(v) : 0.0;
}

void mrd_run_stats_init(struct mrd_run_stats *r)
{
    int i;

    if (r == NULL)
        return;

    memset(r, 0, sizeof(*r));
    for (i = 0; i < MRD_MAX_CHANNELS; i++)
        mrd_accum_init(&r->ch[i]);
    mrd_qc_counters_init(&r->qc);
    mrd_registry_seen_init(&r->stations);
}

void mrd_run_stats_add(struct mrd_run_stats *r,
                       const struct mrd_decoded *d,
                       const struct mrd_qc_result *qc)
{
    int i;

    if (r == NULL || d == NULL)
        return;

    r->parsed_ok++;

    for (i = 0; i < MRD_MAX_CHANNELS; i++)
        mrd_accum_add(&r->ch[i], d->ch[i]);

    /* The QC counters were already updated inside mrd_qc_check when the
     * caller ran the check; qc here is just the per-reading verdict and
     * is available for callers that want it.  We keep the parameter so
     * the fold site reads naturally and future per-verdict tallies have
     * a home. */
    (void)qc;

    mrd_registry_seen_add(&r->stations, d->stnid);
}

void mrd_run_stats_reject(struct mrd_run_stats *r, int parse_rc)
{
    if (r == NULL)
        return;

    r->parse_err++;
    if (parse_rc == -2)
        r->bad_magic++;
    else if (parse_rc == -3)
        r->bad_crc++;
}

void mrd_run_stats_report(const struct mrd_run_stats *r, FILE *fp)
{
    static const int chorder[] = {
        MRD_CH_TMAX, MRD_CH_TMIN, MRD_CH_RAIN,
        MRD_CH_SRAD, MRD_CH_RH, MRD_CH_WIND
    };
    size_t i;
    const struct mrd_accum *a;

    if (r == NULL || fp == NULL)
        return;

    fprintf(fp, "ingest run summary\n");
    fprintf(fp, "  frames: seen=%ld parsed=%ld rejected=%ld"
                " (magic=%ld crc=%ld) stored=%ld\n",
            r->frames_seen, r->parsed_ok, r->parse_err,
            r->bad_magic, r->bad_crc, r->stored);

    fprintf(fp, "  channels:\n");
    for (i = 0; i < sizeof(chorder) / sizeof(chorder[0]); i++) {
        a = &r->ch[chorder[i]];
        if (a->n == 0) {
            fprintf(fp, "      %-5s n=0\n", mrd_channel_name(chorder[i]));
            continue;
        }
        fprintf(fp,
            "      %-5s n=%ld min=%.2f max=%.2f mean=%.2f sd=%.2f\n",
            mrd_channel_name(chorder[i]),
            a->n, a->min, a->max,
            mrd_accum_mean(a), mrd_accum_stddev(a));
    }

    mrd_qc_report(&r->qc, fp);
    mrd_registry_seen_report(&r->stations, fp);
}
