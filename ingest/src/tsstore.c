/* tsstore.c
 * D. Ferreira 2008; SQLite migration 2012-03 by the same.
 */
#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "tsstore.h"

#define SQLBUF 1024

static FILE *g_pipe = NULL;
static long  g_rows = 0;
static char  g_path[512];

int mrd_store_open(const char *path)
{
    char cmd[640];

    if (path == NULL)
        return -1;

    strncpy(g_path, path, sizeof(g_path) - 1);
    g_path[sizeof(g_path) - 1] = '\0';

    snprintf(cmd, sizeof(cmd), "sqlite3 %s", g_path);
    g_pipe = popen(cmd, "w");
    if (g_pipe == NULL)
        return -1;

    fprintf(g_pipe,
        "CREATE TABLE IF NOT EXISTS reading ("
        " stnid TEXT NOT NULL,"
        " year INTEGER NOT NULL,"
        " doy INTEGER NOT NULL,"
        " tmax REAL, tmin REAL, rain REAL, srad REAL, rh REAL, wind REAL,"
        " flags INTEGER NOT NULL DEFAULT 0,"
        " PRIMARY KEY (stnid, year, doy));\n");
    fprintf(g_pipe, "BEGIN;\n");
    g_rows = 0;
    return 0;
}

int mrd_store_append(const struct mrd_packet *p)
{
    char stn[MRD_STNID_LEN + 1];
    int i;

    if (g_pipe == NULL || p == NULL)
        return -1;

    /* The station id is not necessarily NUL terminated in the frame. */
    memcpy(stn, p->stnid, MRD_STNID_LEN);
    stn[MRD_STNID_LEN] = '\0';
    for (i = MRD_STNID_LEN - 1; i >= 0; i--) {
        if (stn[i] == ' ') stn[i] = '\0';
        else break;
    }

    fprintf(g_pipe,
        "INSERT OR REPLACE INTO reading"
        " (stnid, year, doy, tmax, tmin, rain, srad, rh, wind, flags)"
        " VALUES ('%s', %u, %u, %.2f, %.2f, %.2f, %.2f, %.2f, %.2f, %u);\n",
        stn,
        (unsigned)p->year, (unsigned)p->doy,
        mrd_scale(p->value[MRD_CH_TMAX]),
        mrd_scale(p->value[MRD_CH_TMIN]),
        mrd_scale(p->value[MRD_CH_RAIN]),
        mrd_scale(p->value[MRD_CH_SRAD]),
        mrd_scale(p->value[MRD_CH_RH]),
        mrd_scale(p->value[MRD_CH_WIND]),
        (unsigned)p->flags);

    g_rows++;
    return 0;
}

long mrd_store_count(void)
{
    return g_rows;
}

int mrd_store_close(void)
{
    if (g_pipe == NULL)
        return -1;
    fprintf(g_pipe, "COMMIT;\n");
    pclose(g_pipe);
    g_pipe = NULL;
    return 0;
}
