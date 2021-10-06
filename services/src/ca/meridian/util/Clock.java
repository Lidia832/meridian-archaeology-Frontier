package ca.meridian.util;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

/**
 * Time helpers. The reduction to the JDK server in 2017 dropped the
 * Spring-managed clock bean, so this stands in. Deliberately kept off
 * java.time because the collector host was still on Java 7 until the
 * 2019 move and nobody wanted two code paths.
 *
 * M. Brandt, 2017-02
 */
public final class Clock {

    private Clock() {
    }

    /** Wall-clock epoch millis. Wrapped so tests could stub it; they never did. */
    public static long nowMillis() {
        return System.currentTimeMillis();
    }

    public static long nowSeconds() {
        return nowMillis() / 1000L;
    }

    /** ISO-ish UTC stamp, e.g. 2019-06-03T14:22:07Z. */
    public static String isoUtc() {
        return isoUtc(new Date());
    }

    public static String isoUtc(Date d) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(d);
    }

    /** Date-only stamp used by the CSV export filenames. */
    public static String stampDay() {
        SimpleDateFormat f = new SimpleDateFormat("yyyyMMdd");
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }

    /** Elapsed millis since a start reading of {@link #nowMillis()}. */
    public static long since(long startMillis) {
        return nowMillis() - startMillis;
    }
}
