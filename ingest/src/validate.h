/* validate.h - per-channel physical range and QC checks.
 *
 * The 2008 collector accepted any frame whose CRC matched.  That was
 * fine when the loggers were new; by 2019 we had two stations sending
 * physically impossible values for weeks (a swapped tmax/tmin harness
 * at KITCHNER, an rh sensor reading 140% at MILTON) and nothing
 * flagged it.  This module is the quality control gate: it does not
 * reject a reading (the store still takes it) but it decides whether a
 * reading is suspect and why, and it keeps counters so a run can be
 * audited afterwards.
 *
 * J. Tran 2019-06, extended by S. Bauer 2021-08.
 */
#ifndef MERIDIAN_VALIDATE_H
#define MERIDIAN_VALIDATE_H

#include "decode.h"

/* QC reason bits.  A reading can trip several at once.  These are our
 * own flags, distinct from the wire MRD_FLAG_* bits, though the
 * SUSPECT wire bit is folded into the summary. */
#define QC_OK            0x0000u
#define QC_TMAX_RANGE    0x0001u  /* tmax outside plausible absolute band */
#define QC_TMIN_RANGE    0x0002u  /* tmin outside plausible absolute band */
#define QC_TORDER        0x0004u  /* tmax < tmin, the classic swap        */
#define QC_RAIN_NEG      0x0008u  /* negative precipitation               */
#define QC_RAIN_HIGH     0x0010u  /* implausibly large daily rainfall     */
#define QC_SRAD_RANGE    0x0020u  /* solar radiation outside 0..cap       */
#define QC_RH_RANGE      0x0040u  /* relative humidity outside 0..100     */
#define QC_WIND_NEG      0x0080u  /* negative wind speed                  */
#define QC_WIND_HIGH     0x0100u  /* implausibly high wind speed          */
#define QC_DATE_BAD      0x0200u  /* year/doy not a plausible date        */

/* Tunable limits for the checks.  Defaults come from mrd_qc_defaults();
 * callers may loosen or tighten them per run.  Temperatures in deg C,
 * rain in mm/day, srad in MJ/m2/day, rh in percent, wind in m/s. */
struct mrd_qc_limits {
    double tmax_lo, tmax_hi;
    double tmin_lo, tmin_hi;
    double rain_hi;          /* rain_lo is implicitly 0 */
    double srad_lo, srad_hi;
    double rh_lo,  rh_hi;
    double wind_hi;          /* wind_lo is implicitly 0 */
};

/* Running QC counters for a whole ingest pass. */
struct mrd_qc_counters {
    long checked;            /* readings passed through validate       */
    long clean;             /* readings with no QC bit set            */
    long flagged;           /* readings with at least one QC bit set  */
    long wire_suspect;      /* readings that arrived with SUSPECT set  */
    long per_reason[10];    /* count per QC bit, indexed by bit pos    */
};

/* Result of validating one reading. */
struct mrd_qc_result {
    unsigned bits;          /* OR of QC_* reasons                     */
    int      suspect;       /* final suspect verdict (bits || wire)   */
};

/* Fill limits with the standard Ontario-network defaults. */
void mrd_qc_defaults(struct mrd_qc_limits *lim);

/* Zero a counters block. */
void mrd_qc_counters_init(struct mrd_qc_counters *c);

/* Validate one decoded reading against lim, updating counters (may be
 * NULL to skip counting).  Returns the QC result. */
struct mrd_qc_result mrd_qc_check(const struct mrd_decoded *d,
                                  const struct mrd_qc_limits *lim,
                                  struct mrd_qc_counters *c);

/* Human-readable, comma-separated reason string for a bitset, written
 * into buf (size n).  "ok" when no bits set.  Returns bytes needed. */
int mrd_qc_reasons(unsigned bits, char *buf, size_t n);

/* Name of a single QC reason bit, or "?" if not a single known bit. */
const char *mrd_qc_reason_name(unsigned bit);

/* Print a one-block summary of the counters to fp. */
void mrd_qc_report(const struct mrd_qc_counters *c, FILE *fp);

#endif
