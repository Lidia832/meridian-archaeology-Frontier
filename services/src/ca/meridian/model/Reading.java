package ca.meridian.model;

/**
 * A daily weather reading (from the reading table).
 *
 * The flags column is a small bitset the ingest layer sets when a
 * value looks suspect; the meanings live in the ingest subsystem, not
 * here. The anomalies endpoint only cares whether it is non-zero.
 *
 * D. Iqbal 2021
 */
public final class Reading {

    public static final int FLAG_TMAX = 0x01;
    public static final int FLAG_TMIN = 0x02;
    public static final int FLAG_RAIN = 0x04;
    public static final int FLAG_SRAD = 0x08;
    public static final int FLAG_RH   = 0x10;
    public static final int FLAG_WIND = 0x20;

    public final String station;
    public final int year;
    public final int doy;
    public final double tmax;
    public final double tmin;
    public final double rain;
    public final double srad;
    public final double rh;
    public final double wind;
    public final int flags;

    public Reading(String station, int year, int doy, double tmax, double tmin,
                   double rain, double srad, double rh, double wind, int flags) {
        this.station = station;
        this.year = year;
        this.doy = doy;
        this.tmax = tmax;
        this.tmin = tmin;
        this.rain = rain;
        this.srad = srad;
        this.rh = rh;
        this.wind = wind;
        this.flags = flags;
    }

    public boolean isSuspect() {
        return flags != 0;
    }
}
