/* packet.c - frame decoding for the field telemetry link.
 * D. Ferreira 2008-04; CRC added 2009-11 after the Auburn data loss.
 */
#include <string.h>
#include <stdio.h>
#include "packet.h"

static uint32_t rd_u32(const unsigned char *p)
{
    return ((uint32_t)p[0] << 24) | ((uint32_t)p[1] << 16) |
           ((uint32_t)p[2] << 8)  | (uint32_t)p[3];
}

static uint16_t rd_u16(const unsigned char *p)
{
    return (uint16_t)(((uint16_t)p[0] << 8) | (uint16_t)p[1]);
}

static int32_t rd_i32(const unsigned char *p)
{
    return (int32_t)rd_u32(p);
}

uint16_t mrd_crc16(const unsigned char *buf, size_t len)
{
    uint16_t crc = 0xFFFFu;
    size_t i;
    int b;

    for (i = 0; i < len; i++) {
        crc ^= (uint16_t)buf[i] << 8;
        for (b = 0; b < 8; b++) {
            if (crc & 0x8000u)
                crc = (uint16_t)((crc << 1) ^ 0x1021u);
            else
                crc = (uint16_t)(crc << 1);
        }
    }
    return crc;
}

double mrd_scale(int32_t raw)
{
    return (double)raw / 100.0;
}

const char *mrd_channel_name(int ch)
{
    switch (ch) {
    case MRD_CH_TMAX: return "tmax";
    case MRD_CH_TMIN: return "tmin";
    case MRD_CH_RAIN: return "rain";
    case MRD_CH_SRAD: return "srad";
    case MRD_CH_RH:   return "rh";
    case MRD_CH_WIND: return "wind";
    default:          return "unknown";
    }
}

int mrd_packet_parse(const unsigned char *buf, size_t len,
                     struct mrd_packet *out)
{
    int i;
    uint16_t want;

    if (buf == NULL || out == NULL)
        return -1;
    if (len < MRD_PACKET_BYTES)
        return -1;

    out->magic = rd_u32(buf);
    if (out->magic != MRD_MAGIC)
        return -2;

    memcpy(out->stnid, buf + 4, MRD_STNID_LEN);

    out->year = rd_u16(buf + 12);
    out->doy  = rd_u16(buf + 14);

    for (i = 0; i < MRD_MAX_CHANNELS; i++)
        out->value[i] = rd_i32(buf + 16 + (i * 4));

    out->flags = rd_u16(buf + 40);
    out->crc   = rd_u16(buf + 42);

    want = mrd_crc16(buf, 42);
    if (want != out->crc)
        return -3;

    return 0;
}
