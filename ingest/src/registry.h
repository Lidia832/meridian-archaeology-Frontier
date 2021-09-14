/* registry.h - the known-station registry.
 *
 * The collector will happily store a reading for any station id whose
 * frame decodes, because in 2008 the id was just a label.  Once the
 * analytics layer started keying forecasts by station it mattered
 * whether an id was one of ours or a typo / a test rig someone left
 * plugged in.  This registry is the list of stations the network
 * actually operates, with the handful of facts about each that the
 * rest of ingest wants (a display name and a latitude, the latter for
 * sanity only; the model deck carries its own copy).
 *
 * The id set is fixed by CONTRACTS.md and must match it exactly:
 * GUELPH, KITCHNER, WATERLOO, CAMBRIDG, MILTON, BRANTFRD.
 *
 * S. Bauer, 2021-09.
 */
#ifndef MERIDIAN_REGISTRY_H
#define MERIDIAN_REGISTRY_H

#include <stddef.h>
#include "packet.h"

struct mrd_station {
    const char *id;         /* canonical id as it appears on the wire */
    const char *name;       /* human display name                     */
    double      latitude;   /* decimal degrees north                  */
    double      longitude;  /* decimal degrees east (negative = west) */
};

/* Number of registered stations. */
size_t mrd_registry_count(void);

/* Station at index i (0..count-1), or NULL if out of range.  Order is
 * stable and matches the order stations appear in CONTRACTS.md. */
const struct mrd_station *mrd_registry_at(size_t i);

/* Look up a station by trimmed id (case sensitive, as on the wire).
 * Returns the entry or NULL if the id is not one we operate. */
const struct mrd_station *mrd_registry_find(const char *id);

/* Convenience predicate. */
int mrd_registry_known(const char *id);

/* Per-run tally of how many readings each known station contributed,
 * plus a bucket for readings whose id is not in the registry. */
struct mrd_registry_seen {
    long count[8];          /* parallel to registry order; <=8 stations */
    long unknown;           /* readings for ids not in the registry     */
    size_t nknown;          /* snapshot of mrd_registry_count()         */
};

void mrd_registry_seen_init(struct mrd_registry_seen *s);

/* Record one reading for the given (trimmed) id.  Returns the registry
 * index that was credited, or -1 if the id was unknown (the unknown
 * bucket is incremented in that case). */
int mrd_registry_seen_add(struct mrd_registry_seen *s, const char *id);

/* Print the seen tally to fp. */
void mrd_registry_seen_report(const struct mrd_registry_seen *s, FILE *fp);

#include <stdio.h>

#endif
