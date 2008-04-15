/* tsstore.h - append path into the reading store.
 * The store was a flat binary file until 2012; it is now SQLite,
 * reached through the sqlite3 command line because linking the
 * library on the old collector host was not possible.  See MRD-77.
 */
#ifndef MERIDIAN_TSSTORE_H
#define MERIDIAN_TSSTORE_H

#include "packet.h"

int  mrd_store_open(const char *path);
int  mrd_store_append(const struct mrd_packet *p);
int  mrd_store_close(void);
long mrd_store_count(void);

#endif
