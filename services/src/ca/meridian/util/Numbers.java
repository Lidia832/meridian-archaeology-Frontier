package ca.meridian.util;

import java.util.List;

/**
 * Small numeric helpers for the aggregate endpoints.
 *
 * SQLite does the AVG/MIN/MAX in the query, but a couple of the
 * derived figures (rounding for display, the odd standard deviation
 * the overview cards asked for in 2022) are easier to do here than to
 * express in the shell-out SQL. Nothing statistically fancy.
 *
 * S. Whitfield 2019, extended 2022
 */
public final class Numbers {

    private Numbers() {
    }

    /** Rounds to n decimal places, half-up, for JSON display. */
    public static double round(double v, int places) {
        if (Double.isNaN(v) || Double.isInfinite(v)) {
            return 0.0;
        }
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }

    public static double round3(double v) {
        return round(v, 3);
    }

    public static double mean(List<Double> xs) {
        if (xs == null || xs.isEmpty()) {
            return 0.0;
        }
        double sum = 0.0;
        for (double x : xs) {
            sum += x;
        }
        return sum / xs.size();
    }

    /** Population standard deviation; returns 0 for fewer than two points. */
    public static double stdev(List<Double> xs) {
        if (xs == null || xs.size() < 2) {
            return 0.0;
        }
        double m = mean(xs);
        double acc = 0.0;
        for (double x : xs) {
            double d = x - m;
            acc += d * d;
        }
        return Math.sqrt(acc / xs.size());
    }

    public static boolean isFinite(double v) {
        return !Double.isNaN(v) && !Double.isInfinite(v);
    }
}
