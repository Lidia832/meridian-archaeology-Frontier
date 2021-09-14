/* registry.c - the known-station registry.
 *
 * S. Bauer, 2021-09.
 *
 * The latitudes/longitudes here are the surveyed sites; they are for
 * cross-checking only.  The model input deck (DECKFMT REC1) carries the
 * latitude the model actually uses, and I deliberately did not wire
 * these into that path -- I could not find where the deck latitude is
 * sourced from and did not want to change an answer the agronomy team
 * has been validating against for years.  If you unify them, do it in
 * the analytics deck writer, not here.   -- SB
 */
#define _POSIX_C_SOURCE 200809L

#include <string.h>
#include <stdio.h>
#include "registry.h"

/* Fixed roster.  The id column MUST equal the set in CONTRACTS.md; the
 * ingest test asserts exactly these six show up in the store. */
static const struct mrd_station g_stations[] = {
    { "GUELPH",   "Guelph Arboretum",     43.5327, -80.2131 },
    { "KITCHNER", "Kitchener Bridgeport", 43.4516, -80.4925 },
    { "WATERLOO", "Waterloo North Campus",43.4723, -80.5449 },
    { "CAMBRIDG", "Cambridge Galt",       43.3616, -80.3144 },
    { "MILTON",   "Milton Escarpment",    43.5183, -79.8774 },
    { "BRANTFRD", "Brantford Grand River",43.1394, -80.2644 }
};

#define NSTATIONS (sizeof(g_stations) / sizeof(g_stations[0]))

size_t mrd_registry_count(void)
{
    return NSTATIONS;
}

const struct mrd_station *mrd_registry_at(size_t i)
{
    if (i >= NSTATIONS)
        return NULL;
    return &g_stations[i];
}

const struct mrd_station *mrd_registry_find(const char *id)
{
    size_t i;

    if (id == NULL)
        return NULL;

    for (i = 0; i < NSTATIONS; i++) {
        if (strcmp(g_stations[i].id, id) == 0)
            return &g_stations[i];
    }
    return NULL;
}

int mrd_registry_known(const char *id)
{
    return mrd_registry_find(id) != NULL;
}

void mrd_registry_seen_init(struct mrd_registry_seen *s)
{
    if (s == NULL)
        return;
    memset(s, 0, sizeof(*s));
    s->nknown = NSTATIONS;
}

/* Internal: index of id in the roster, or -1. */
static int registry_index(const char *id)
{
    size_t i;

    if (id == NULL)
        return -1;
    for (i = 0; i < NSTATIONS; i++) {
        if (strcmp(g_stations[i].id, id) == 0)
            return (int)i;
    }
    return -1;
}

int mrd_registry_seen_add(struct mrd_registry_seen *s, const char *id)
{
    int idx;

    if (s == NULL)
        return -1;

    idx = registry_index(id);
    if (idx < 0) {
        s->unknown++;
        return -1;
    }
    s->count[idx]++;
    return idx;
}

void mrd_registry_seen_report(const struct mrd_registry_seen *s, FILE *fp)
{
    size_t i;

    if (s == NULL || fp == NULL)
        return;

    fprintf(fp, "  stations:\n");
    for (i = 0; i < NSTATIONS; i++) {
        fprintf(fp, "      %-8s %-24s %6ld\n",
                g_stations[i].id, g_stations[i].name, s->count[i]);
    }
    if (s->unknown > 0)
        fprintf(fp, "      %-8s %-24s %6ld\n",
                "(unknown)", "not in registry", s->unknown);
}
