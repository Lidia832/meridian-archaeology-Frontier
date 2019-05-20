/* validate.c - per-channel physical range and QC checks.
 *
 * J. Tran 2019-06; range tuning and the tmax/tmin order check added by
 * S. Bauer 2021-08 after the KITCHNER harness swap.
 *
 * A note for whoever reads this next: the wire frame already carries a
 * SUSPECT bit (MRD_FLAG_SUSPECT) that the field techs set by hand from
 * the logger console.  I have never fully understood the rule the
 * techs use to set it -- it does not line up with any range we check
 * here -- so this module treats the wire bit and our computed bits as
 * two independent opinions and just ORs them into the final verdict.
 * If someone learns what the manual bit actually means, revisit
 * mrd_qc_check() rather than second-guessing it here.   -- SB
 */
#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>
#include "validate.h"

void mrd_qc_defaults(struct mrd_qc_limits *lim)
{
    if (lim == NULL)
        return;
    /* Absolute plausible bands for southern Ontario field stations.
     * These are intentionally wide: the point is to catch a stuck
     * sensor or a byte-swap, not to second guess a cold snap. */
    lim->tmax_lo = -45.0;
    lim->tmax_hi =  50.0;
    lim->tmin_lo = -50.0;
    lim->tmin_hi =  45.0;
    lim->rain_hi = 300.0;   /* mm in one day is already a record event */
    lim->srad_lo =   0.0;
    lim->srad_hi =  42.0;   /* clear-sky summit is ~40 MJ/m2/day here  */
    lim->rh_lo   =   0.0;
    lim->rh_hi   = 100.0;
    lim->wind_hi =  60.0;   /* m/s; a sustained 60 is a severe storm   */
}

void mrd_qc_counters_init(struct mrd_qc_counters *c)
{
    if (c == NULL)
        return;
    memset(c, 0, sizeof(*c));
}

/* Map a single-bit QC flag to its position 0..9 for the per_reason
 * array.  Returns -1 if bit is not a single known flag. */
static int reason_index(unsigned bit)
{
    switch (bit) {
    case QC_TMAX_RANGE: return 0;
    case QC_TMIN_RANGE: return 1;
    case QC_TORDER:     return 2;
    case QC_RAIN_NEG:   return 3;
    case QC_RAIN_HIGH:  return 4;
    case QC_SRAD_RANGE: return 5;
    case QC_RH_RANGE:   return 6;
    case QC_WIND_NEG:   return 7;
    case QC_WIND_HIGH:  return 8;
    case QC_DATE_BAD:   return 9;
    default:            return -1;
    }
}

const char *mrd_qc_reason_name(unsigned bit)
{
    switch (bit) {
    case QC_TMAX_RANGE: return "tmax_range";
    case QC_TMIN_RANGE: return "tmin_range";
    case QC_TORDER:     return "tmax_lt_tmin";
    case QC_RAIN_NEG:   return "rain_negative";
    case QC_RAIN_HIGH:  return "rain_high";
    case QC_SRAD_RANGE: return "srad_range";
    case QC_RH_RANGE:   return "rh_range";
    case QC_WIND_NEG:   return "wind_negative";
    case QC_WIND_HIGH:  return "wind_high";
    case QC_DATE_BAD:   return "date_bad";
    default:            return "?";
    }
}

struct mrd_qc_result mrd_qc_check(const struct mrd_decoded *d,
                                  const struct mrd_qc_limits *lim,
                                  struct mrd_qc_counters *c)
{
    struct mrd_qc_result r;
    struct mrd_qc_limits local;
    double tmax, tmin, rain, srad, rh, wind;
    unsigned b;
    int i;

    r.bits = QC_OK;
    r.suspect = 0;

    if (d == NULL)
        return r;

    /* Fall back to defaults if the caller passed none. */
    if (lim == NULL) {
        mrd_qc_defaults(&local);
        lim = &local;
    }

    tmax = d->ch[MRD_CH_TMAX];
    tmin = d->ch[MRD_CH_TMIN];
    rain = d->ch[MRD_CH_RAIN];
    srad = d->ch[MRD_CH_SRAD];
    rh   = d->ch[MRD_CH_RH];
    wind = d->ch[MRD_CH_WIND];

    /* Temperature absolute bands. */
    if (tmax < lim->tmax_lo || tmax > lim->tmax_hi)
        r.bits |= QC_TMAX_RANGE;
    if (tmin < lim->tmin_lo || tmin > lim->tmin_hi)
        r.bits |= QC_TMIN_RANGE;

    /* Ordering: the daily maximum cannot fall below the daily minimum.
     * A small epsilon avoids flagging a station that reports tmax==tmin
     * on a flat overcast day. */
    if (tmax + 1e-6 < tmin)
        r.bits |= QC_TORDER;

    /* Precipitation: never negative, and a sane upper bound. */
    if (rain < 0.0)
        r.bits |= QC_RAIN_NEG;
    else if (rain > lim->rain_hi)
        r.bits |= QC_RAIN_HIGH;

    /* Solar radiation band. */
    if (srad < lim->srad_lo || srad > lim->srad_hi)
        r.bits |= QC_SRAD_RANGE;

    /* Relative humidity is a percentage. */
    if (rh < lim->rh_lo || rh > lim->rh_hi)
        r.bits |= QC_RH_RANGE;

    /* Wind: never negative, sane upper bound. */
    if (wind < 0.0)
        r.bits |= QC_WIND_NEG;
    else if (wind > lim->wind_hi)
        r.bits |= QC_WIND_HIGH;

    /* Date plausibility. */
    if (!mrd_decoded_date_ok(d))
        r.bits |= QC_DATE_BAD;

    /* Final verdict: suspect if we found anything, OR if the field tech
     * already marked it suspect on the wire.  See the file header note
     * about why these two are kept independent. */
    r.suspect = (r.bits != QC_OK) || d->suspect;

    if (c != NULL) {
        c->checked++;
        if (r.bits == QC_OK)
            c->clean++;
        else
            c->flagged++;
        if (d->suspect)
            c->wire_suspect++;
        for (b = 1; b != 0; b <<= 1) {
            if (r.bits & b) {
                i = reason_index(b);
                if (i >= 0)
                    c->per_reason[i]++;
            }
        }
    }

    return r;
}

int mrd_qc_reasons(unsigned bits, char *buf, size_t n)
{
    static const unsigned order[] = {
        QC_TMAX_RANGE, QC_TMIN_RANGE, QC_TORDER, QC_RAIN_NEG, QC_RAIN_HIGH,
        QC_SRAD_RANGE, QC_RH_RANGE, QC_WIND_NEG, QC_WIND_HIGH, QC_DATE_BAD
    };
    size_t i;
    int used = 0;
    int first = 1;

    if (buf == NULL || n == 0)
        return 0;

    if (bits == QC_OK)
        return snprintf(buf, n, "ok");

    buf[0] = '\0';
    for (i = 0; i < sizeof(order) / sizeof(order[0]); i++) {
        if (bits & order[i]) {
            used += snprintf(buf + (used < (int)n ? used : (int)n - 1),
                             used < (int)n ? n - used : 1,
                             "%s%s", first ? "" : ",",
                             mrd_qc_reason_name(order[i]));
            first = 0;
        }
    }
    return used;
}

void mrd_qc_report(const struct mrd_qc_counters *c, FILE *fp)
{
    static const unsigned order[] = {
        QC_TMAX_RANGE, QC_TMIN_RANGE, QC_TORDER, QC_RAIN_NEG, QC_RAIN_HIGH,
        QC_SRAD_RANGE, QC_RH_RANGE, QC_WIND_NEG, QC_WIND_HIGH, QC_DATE_BAD
    };
    size_t i;
    int idx;

    if (c == NULL || fp == NULL)
        return;

    fprintf(fp, "  QC: checked=%ld clean=%ld flagged=%ld wire_suspect=%ld\n",
            c->checked, c->clean, c->flagged, c->wire_suspect);
    for (i = 0; i < sizeof(order) / sizeof(order[0]); i++) {
        idx = reason_index(order[i]);
        if (idx >= 0 && c->per_reason[idx] > 0)
            fprintf(fp, "      %-14s %ld\n",
                    mrd_qc_reason_name(order[i]), c->per_reason[idx]);
    }
}
