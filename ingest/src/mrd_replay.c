/* mrd_replay.c - read the reading store back out as a CSV summary.
 *
 * The collector writes; this reads.  Given a store.db it walks the
 * reading table and emits either a per-station season summary (the
 * default) or the full daily series, as CSV on stdout.  Analytics has
 * its own Python path into the store; this exists for the field techs,
 * who wanted a no-dependency way to eyeball what a night's collection
 * actually landed.
 *
 * S. Bauer, 2021-11.
 *
 * Like the writer, this reaches the database through the sqlite3
 * command line rather than the library (MRD-77): we popen a SELECT and
 * parse its output.  It is the same trade the collector makes and for
 * the same reason -- the old host could not link libsqlite3 -- so the
 * two tools stay symmetric.  Nothing here links the library.
 */
#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "packet.h"
#include "registry.h"
#include "stats.h"

#define SEP '|'
#define LINEBUF 512

enum replay_mode { MODE_SUMMARY, MODE_DAILY };

/* Per-station rollup used by the summary mode. */
struct station_roll {
    char   id[MRD_STNID_LEN + 1];
    long   rows;
    long   suspect;                 /* rows with the wire SUSPECT bit  */
    int    year_lo, year_hi;
    int    doy_lo, doy_hi;
    struct mrd_accum ch[MRD_MAX_CHANNELS];
    int    used;
};

#define MAX_ROLL 64

static struct station_roll g_roll[MAX_ROLL];
static int g_nroll = 0;

static struct station_roll *roll_for(const char *id)
{
    int i;

    for (i = 0; i < g_nroll; i++) {
        if (strcmp(g_roll[i].id, id) == 0)
            return &g_roll[i];
    }
    if (g_nroll >= MAX_ROLL)
        return NULL;

    {
        struct station_roll *r = &g_roll[g_nroll++];
        int c;
        memset(r, 0, sizeof(*r));
        strncpy(r->id, id, MRD_STNID_LEN);
        r->id[MRD_STNID_LEN] = '\0';
        r->year_lo = r->doy_lo = 1 << 30;
        r->year_hi = r->doy_hi = -(1 << 30);
        for (c = 0; c < MRD_MAX_CHANNELS; c++)
            mrd_accum_init(&r->ch[c]);
        r->used = 1;
        return r;
    }
}

/* Split a SEP-delimited line into up to maxf fields in place.  Returns
 * the field count.  Trailing newline is stripped. */
static int split_fields(char *line, char **out, int maxf)
{
    int n = 0;
    char *p = line;
    size_t len = strlen(line);

    while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r'))
        line[--len] = '\0';

    out[n++] = p;
    for (; *p != '\0' && n < maxf; p++) {
        if (*p == SEP) {
            *p = '\0';
            out[n++] = p + 1;
        }
    }
    /* consume any remaining separators so counts stay honest */
    for (; *p != '\0'; p++) {
        if (*p == SEP)
            n++;
    }
    return n;
}

/* Build the sqlite3 read command.  Same shell-out mechanism as the
 * writer; the query is fixed text, only the path is interpolated. */
static FILE *open_query(const char *db)
{
    char cmd[768];

    snprintf(cmd, sizeof(cmd),
        "sqlite3 -batch -noheader -separator '%c' %s "
        "\"SELECT stnid,year,doy,tmax,tmin,rain,srad,rh,wind,flags "
        "FROM reading ORDER BY stnid,year,doy\"",
        SEP, db);
    return popen(cmd, "r");
}

static void accumulate(struct station_roll *r, int year, int doy,
                       const double v[MRD_MAX_CHANNELS], unsigned flags)
{
    int c;

    r->rows++;
    if (flags & MRD_FLAG_SUSPECT)
        r->suspect++;
    if (year < r->year_lo) r->year_lo = year;
    if (year > r->year_hi) r->year_hi = year;
    if (doy  < r->doy_lo)  r->doy_lo  = doy;
    if (doy  > r->doy_hi)  r->doy_hi  = doy;
    for (c = 0; c < MRD_MAX_CHANNELS; c++)
        mrd_accum_add(&r->ch[c], v[c]);
}

static void emit_summary(FILE *out)
{
    int i;

    fprintf(out,
        "stnid,name,rows,suspect,year_lo,year_hi,doy_lo,doy_hi,"
        "tmax_mean,tmin_mean,rain_total,srad_mean,rh_mean,wind_mean\n");

    for (i = 0; i < g_nroll; i++) {
        struct station_roll *r = &g_roll[i];
        const struct mrd_station *s = mrd_registry_find(r->id);
        const char *name = s ? s->name : "(unknown)";

        fprintf(out,
            "%s,%s,%ld,%ld,%d,%d,%d,%d,"
            "%.2f,%.2f,%.2f,%.2f,%.2f,%.2f\n",
            r->id, name, r->rows, r->suspect,
            r->year_lo, r->year_hi, r->doy_lo, r->doy_hi,
            mrd_accum_mean(&r->ch[MRD_CH_TMAX]),
            mrd_accum_mean(&r->ch[MRD_CH_TMIN]),
            r->ch[MRD_CH_RAIN].sum,        /* rain reported as season total */
            mrd_accum_mean(&r->ch[MRD_CH_SRAD]),
            mrd_accum_mean(&r->ch[MRD_CH_RH]),
            mrd_accum_mean(&r->ch[MRD_CH_WIND]));
    }
}

static void usage(const char *argv0)
{
    fprintf(stderr,
        "usage: %s <store.db> [--daily]\n"
        "  default: per-station season summary as CSV on stdout\n"
        "  --daily: the full reading series as CSV on stdout\n",
        argv0);
}

int main(int argc, char **argv)
{
    const char *db;
    enum replay_mode mode = MODE_SUMMARY;
    FILE *q;
    char line[LINEBUF];
    char *f[16];
    long total_rows = 0;

    if (argc < 2 || argc > 3) {
        usage(argv[0]);
        return 1;
    }
    db = argv[1];
    if (argc == 3) {
        if (strcmp(argv[2], "--daily") == 0)
            mode = MODE_DAILY;
        else {
            usage(argv[0]);
            return 1;
        }
    }

    q = open_query(db);
    if (q == NULL) {
        fprintf(stderr, "mrd_replay: cannot query store %s\n", db);
        return 1;
    }

    if (mode == MODE_DAILY)
        printf("stnid,year,doy,tmax,tmin,rain,srad,rh,wind,flags\n");

    while (fgets(line, sizeof(line), q) != NULL) {
        int nf = split_fields(line, f, 16);
        int year, doy;
        unsigned flags;
        double v[MRD_MAX_CHANNELS];

        if (nf < 10)
            continue;           /* malformed / blank line */

        year  = atoi(f[1]);
        doy   = atoi(f[2]);
        v[MRD_CH_TMAX] = atof(f[3]);
        v[MRD_CH_TMIN] = atof(f[4]);
        v[MRD_CH_RAIN] = atof(f[5]);
        v[MRD_CH_SRAD] = atof(f[6]);
        v[MRD_CH_RH]   = atof(f[7]);
        v[MRD_CH_WIND] = atof(f[8]);
        flags = (unsigned)strtoul(f[9], NULL, 10);

        total_rows++;

        if (mode == MODE_DAILY) {
            printf("%s,%d,%d,%.2f,%.2f,%.2f,%.2f,%.2f,%.2f,%u\n",
                   f[0], year, doy,
                   v[MRD_CH_TMAX], v[MRD_CH_TMIN], v[MRD_CH_RAIN],
                   v[MRD_CH_SRAD], v[MRD_CH_RH], v[MRD_CH_WIND], flags);
        } else {
            struct station_roll *r = roll_for(f[0]);
            if (r != NULL)
                accumulate(r, year, doy, v, flags);
        }
    }

    if (pclose(q) == -1)
        fprintf(stderr, "mrd_replay: warning: pclose failed\n");

    if (mode == MODE_SUMMARY)
        emit_summary(stdout);

    fprintf(stderr, "mrd_replay: %ld rows across %d stations\n",
            total_rows, mode == MODE_SUMMARY ? g_nroll : -1);

    return 0;
}
