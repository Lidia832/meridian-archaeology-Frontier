/* decode.c - higher level frame decode helpers over packet.c.
 *
 * J. Tran, 2019-05.
 *
 * History: the original collector kept the scaling inline in the store
 * writer (tsstore.c still does its own, which is fine, it predates
 * this file).  When the srad channel was briefly emitted in langleys
 * instead of MJ by one firmware batch we had four separate copies of
 * "/ 100.0" to audit.  Pulling the conversion into one place made that
 * kind of thing findable.  All this file is allowed to know about the
 * wire format is what packet.h exposes.
 */
#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>
#include "decode.h"

int mrd_decode_stnid(const char raw[MRD_STNID_LEN], char *dst)
{
    int i;
    int len;

    if (raw == NULL || dst == NULL)
        return 0;

    /* The frame field is not NUL terminated, so copy the fixed width
     * and terminate ourselves. */
    memcpy(dst, raw, MRD_STNID_LEN);
    dst[MRD_STNID_LEN] = '\0';

    /* Trim trailing spaces from the right.  This mirrors tsstore.c on
     * purpose; see MRD-227.  We do not trim leading spaces because no
     * known station id starts with one and a leading space more likely
     * signals corruption we want to keep visible. */
    for (i = MRD_STNID_LEN - 1; i >= 0; i--) {
        if (dst[i] == ' ')
            dst[i] = '\0';
        else
            break;
    }

    len = 0;
    while (dst[len] != '\0')
        len++;
    return len;
}

int mrd_decode(const struct mrd_packet *p, struct mrd_decoded *out)
{
    int i;

    if (p == NULL || out == NULL)
        return -1;

    memset(out, 0, sizeof(*out));

    mrd_decode_stnid(p->stnid, out->stnid);

    out->year = (int)p->year;
    out->doy  = (int)p->doy;

    for (i = 0; i < MRD_MAX_CHANNELS; i++)
        out->ch[i] = mrd_scale(p->value[i]);

    out->flags   = (unsigned)p->flags;
    out->suspect = (p->flags & MRD_FLAG_SUSPECT) ? 1 : 0;
    out->manual  = (p->flags & MRD_FLAG_MANUAL) ? 1 : 0;

    return 0;
}

double mrd_decoded_tmax(const struct mrd_decoded *d)
{
    return d ? d->ch[MRD_CH_TMAX] : 0.0;
}

double mrd_decoded_tmin(const struct mrd_decoded *d)
{
    return d ? d->ch[MRD_CH_TMIN] : 0.0;
}

double mrd_decoded_rain(const struct mrd_decoded *d)
{
    return d ? d->ch[MRD_CH_RAIN] : 0.0;
}

double mrd_decoded_srad(const struct mrd_decoded *d)
{
    return d ? d->ch[MRD_CH_SRAD] : 0.0;
}

double mrd_decoded_rh(const struct mrd_decoded *d)
{
    return d ? d->ch[MRD_CH_RH] : 0.0;
}

double mrd_decoded_wind(const struct mrd_decoded *d)
{
    return d ? d->ch[MRD_CH_WIND] : 0.0;
}

int mrd_decoded_date_ok(const struct mrd_decoded *d)
{
    if (d == NULL)
        return 0;
    /* The wire year is a u16.  Real deployment years are 2008..~2100.
     * Anything outside a very wide window is corruption, not a date. */
    if (d->year < 2000 || d->year > 2100)
        return 0;
    /* doy is 1..366.  We do not special-case non-leap years here; the
     * model layer owns the calendar, we only reject the impossible. */
    if (d->doy < 1 || d->doy > 366)
        return 0;
    return 1;
}

int mrd_decoded_format(const struct mrd_decoded *d, char *buf, size_t n)
{
    if (d == NULL || buf == NULL || n == 0)
        return 0;

    return snprintf(buf, n,
        "%-8s %4d/%03d tmax=%.2f tmin=%.2f rain=%.2f "
        "srad=%.2f rh=%.2f wind=%.2f flags=0x%04x",
        d->stnid, d->year, d->doy,
        d->ch[MRD_CH_TMAX], d->ch[MRD_CH_TMIN], d->ch[MRD_CH_RAIN],
        d->ch[MRD_CH_SRAD], d->ch[MRD_CH_RH], d->ch[MRD_CH_WIND],
        d->flags);
}
