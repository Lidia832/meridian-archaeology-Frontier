/* spool.c - spool file reader abstraction.
 *
 * J. Tran, 2019-07.
 *
 * Reads a spool one fixed-size frame at a time.  The old inline loop in
 * mrd_ingest.c read a 4KB chunk rounded down to a frame multiple and
 * walked it; functionally identical, but nothing else could reuse it
 * and the short-tail accounting was easy to get wrong.  Here the tail
 * handling lives in one place: a read that returns fewer than
 * MRD_PACKET_BYTES bytes at end of file is a short tail, recorded and
 * reported, never handed out as a frame.
 */
#define _POSIX_C_SOURCE 200809L

#include <string.h>
#include <errno.h>
#include "spool.h"

static void spool_stats_init(struct mrd_spool_stats *st)
{
    st->frames_read = 0;
    st->bytes_read = 0;
    st->short_tail = 0;
    st->eof = 0;
}

int mrd_spool_open(struct mrd_spool *s, const char *path)
{
    if (s == NULL || path == NULL)
        return -1;

    memset(s, 0, sizeof(*s));
    spool_stats_init(&s->st);

    s->fp = fopen(path, "rb");
    if (s->fp == NULL)
        return -1;
    s->owns_fp = 1;
    return 0;
}

int mrd_spool_wrap(struct mrd_spool *s, FILE *fp)
{
    if (s == NULL || fp == NULL)
        return -1;

    memset(s, 0, sizeof(*s));
    spool_stats_init(&s->st);
    s->fp = fp;
    s->owns_fp = 0;
    return 0;
}

int mrd_spool_next(struct mrd_spool *s, unsigned char *out)
{
    size_t got;

    if (s == NULL || out == NULL || s->fp == NULL)
        return -1;

    if (s->st.eof)
        return 0;

    /* One frame is fixed width.  fread will return a short count only
     * at end of file (or on error); either way we are done. */
    got = fread(s->frame, 1, MRD_PACKET_BYTES, s->fp);
    s->st.bytes_read += (long)got;

    if (got == 0) {
        /* Clean EOF exactly on a frame boundary. */
        s->st.eof = 1;
        return 0;
    }

    if (got < (size_t)MRD_PACKET_BYTES) {
        /* File ended mid-frame.  Record the tail and stop. */
        s->st.short_tail = (int)got;
        s->st.eof = 1;
        return -1;
    }

    memcpy(out, s->frame, MRD_PACKET_BYTES);
    s->st.frames_read++;
    return 1;
}

struct mrd_spool_stats mrd_spool_get_stats(const struct mrd_spool *s)
{
    struct mrd_spool_stats empty;

    if (s == NULL) {
        spool_stats_init(&empty);
        return empty;
    }
    return s->st;
}

int mrd_spool_close(struct mrd_spool *s)
{
    if (s == NULL)
        return -1;

    if (s->fp != NULL && s->owns_fp) {
        fclose(s->fp);
    }
    s->fp = NULL;
    s->owns_fp = 0;
    return 0;
}

void mrd_spool_report(const struct mrd_spool *s, FILE *fp)
{
    if (s == NULL || fp == NULL)
        return;

    fprintf(fp, "  spool: frames=%ld bytes=%ld",
            s->st.frames_read, s->st.bytes_read);
    if (s->st.short_tail > 0)
        fprintf(fp, " short_tail=%d", s->st.short_tail);
    fprintf(fp, "\n");
}
