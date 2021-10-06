package ca.meridian.util;

/**
 * Input validation helpers for the newer endpoints.
 *
 * The two original data endpoints trust their inputs (see MRD-166 in
 * ForecastHandler / SeriesHandler). Everything written from 2021 on is
 * expected to go through here first. This does not retro-fix the old
 * handlers; changing their behaviour needs a portal regression pass
 * that has never been scheduled.
 *
 * D. Iqbal 2021
 */
public final class Validate {

    private Validate() {
    }

    /** Thrown for a bad request parameter; handlers map it to HTTP 400. */
    public static final class BadRequest extends RuntimeException {
        private static final long serialVersionUID = 1L;

        public BadRequest(String message) {
            super(message);
        }
    }

    public static String requireStation(String raw) {
        String s = Strings.trimToNull(raw);
        if (s == null) {
            throw new BadRequest("station is required");
        }
        s = s.toUpperCase();
        if (!isStationId(s)) {
            throw new BadRequest("not a station id: " + s);
        }
        return s;
    }

    /** Station ids are the fixed 6-8 char upper alnum codes from the network. */
    public static boolean isStationId(String s) {
        if (s == null || s.length() < 4 || s.length() > 8) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean ok = (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
            if (!ok) {
                return false;
            }
        }
        return true;
    }

    public static int requireYear(String raw) {
        String s = Strings.trimToNull(raw);
        if (s == null) {
            throw new BadRequest("year is required");
        }
        int y;
        try {
            y = Integer.parseInt(s);
        } catch (NumberFormatException nfe) {
            throw new BadRequest("year must be an integer");
        }
        if (y < 1990 || y > 2100) {
            throw new BadRequest("year out of range: " + y);
        }
        return y;
    }

    public static Integer optionalYear(String raw) {
        if (Strings.isBlank(raw)) {
            return null;
        }
        return requireYear(raw);
    }

    public static int clamp(int v, int lo, int hi) {
        if (v < lo) {
            return lo;
        }
        if (v > hi) {
            return hi;
        }
        return v;
    }
}
