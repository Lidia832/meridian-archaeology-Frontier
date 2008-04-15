/* packet.h - Meridian field telemetry packet format.
 *
 * Station loggers emit fixed-size binary frames over the collector
 * link.  The format has not changed since the 2008 deployment and
 * cannot change without reflashing every logger in the field.
 *
 * D. Ferreira, 2008-04
 */
#ifndef MERIDIAN_PACKET_H
#define MERIDIAN_PACKET_H

#include <stdint.h>
#include <stddef.h>

#define MRD_MAGIC        0x4D524431u   /* "MRD1" */
#define MRD_STNID_LEN    8
#define MRD_PACKET_BYTES 44
#define MRD_MAX_CHANNELS 6

/* Channel ordering is positional and is baked into the logger
 * firmware.  Do not reorder. */
enum mrd_channel {
    MRD_CH_TMAX = 0,
    MRD_CH_TMIN = 1,
    MRD_CH_RAIN = 2,
    MRD_CH_SRAD = 3,
    MRD_CH_RH   = 4,
    MRD_CH_WIND = 5
};

struct mrd_packet {
    uint32_t magic;
    char     stnid[MRD_STNID_LEN];
    uint16_t year;
    uint16_t doy;
    int32_t  value[MRD_MAX_CHANNELS];  /* scaled by 100, see mrd_scale */
    uint16_t flags;
    uint16_t crc;
};

#define MRD_FLAG_SUSPECT 0x0001u
#define MRD_FLAG_MANUAL  0x0002u

int  mrd_packet_parse(const unsigned char *buf, size_t len,
                      struct mrd_packet *out);
double mrd_scale(int32_t raw);
uint16_t mrd_crc16(const unsigned char *buf, size_t len);
const char *mrd_channel_name(int ch);

#endif
