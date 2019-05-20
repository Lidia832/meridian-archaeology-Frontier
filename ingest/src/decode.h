/* decode.h - higher level frame decode helpers.
 *
 * packet.c parses the wire frame into a struct mrd_packet holding the
 * raw, still-scaled integer channels exactly as they came off the
 * logger link.  Almost everything downstream (validation, statistics,
 * the replay tool) wants the same three things instead: a clean
 * station id, the year/doy, and the six channels already converted to
 * engineering units.  Before this file existed each caller repeated
 * that conversion, which is how the srad-in-langleys bug of 2019 got
 * in.  So it lives here once.
 *
 * J. Tran, 2019-05.  Sits strictly on top of packet.c; it does not
 * re-read the wire format and must not.
 */
#ifndef MERIDIAN_DECODE_H
#define MERIDIAN_DECODE_H

#include "packet.h"

/* A frame after decode: identity plus channels in engineering units.
 * The channel array is indexed by enum mrd_channel, same ordering as
 * the wire frame, so decoded.ch[MRD_CH_TMAX] is the max temperature in
 * degrees C. */
struct mrd_decoded {
    char   stnid[MRD_STNID_LEN + 1]; /* trimmed, NUL terminated */
    int    year;
    int    doy;
    double ch[MRD_MAX_CHANNELS];
    unsigned flags;
    int    suspect;                  /* nonzero if MRD_FLAG_SUSPECT set */
    int    manual;                   /* nonzero if MRD_FLAG_MANUAL set  */
};

/* Copy the frame's space-padded station id into dst and strip trailing
 * spaces.  dst must hold at least MRD_STNID_LEN+1 bytes.  Returns the
 * length of the trimmed id.
 *
 * Note: this is the same by-hand trim the store does (MRD-227); an id
 * that legitimately ends in spaces cannot be distinguished from a
 * padded one.  Kept deliberately identical so the two code paths agree
 * on what a station is called. */
int mrd_decode_stnid(const char raw[MRD_STNID_LEN], char *dst);

/* Fill out from an already-parsed packet.  Never fails on a
 * well-formed packet; returns 0, or -1 if a pointer is NULL. */
int mrd_decode(const struct mrd_packet *p, struct mrd_decoded *out);

/* Named channel accessors over a decoded reading, for readability at
 * the call sites.  These just index ch[]. */
double mrd_decoded_tmax(const struct mrd_decoded *d);
double mrd_decoded_tmin(const struct mrd_decoded *d);
double mrd_decoded_rain(const struct mrd_decoded *d);
double mrd_decoded_srad(const struct mrd_decoded *d);
double mrd_decoded_rh(const struct mrd_decoded *d);
double mrd_decoded_wind(const struct mrd_decoded *d);

/* Convenience: is the (year, doy) plausibly a real calendar day?  Does
 * not consult a calendar for leap years beyond the 366 cap; the logger
 * clock is the authority and this only catches gross corruption. */
int mrd_decoded_date_ok(const struct mrd_decoded *d);

/* Format a decoded reading as one human line into buf (size n).
 * Returns the number of bytes that would have been written, snprintf
 * style. */
int mrd_decoded_format(const struct mrd_decoded *d, char *buf, size_t n);

#endif
