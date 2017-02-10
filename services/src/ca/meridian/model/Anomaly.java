package ca.meridian.model;

import java.util.ArrayList;
import java.util.List;

/**
 * A flagged reading, decoded for the /api/anomalies endpoint.
 *
 * D. Iqbal 2021
 */
public final class Anomaly {

    public final String station;
    public final int year;
    public final int doy;
    public final int flags;

    public Anomaly(String station, int year, int doy, int flags) {
        this.station = station;
        this.year = year;
        this.doy = doy;
        this.flags = flags;
    }

    /** Human-readable list of which channels tripped. */
    public List<String> reasons() {
        List<String> out = new ArrayList<>();
        if ((flags & Reading.FLAG_TMAX) != 0) { out.add("tmax"); }
        if ((flags & Reading.FLAG_TMIN) != 0) { out.add("tmin"); }
        if ((flags & Reading.FLAG_RAIN) != 0) { out.add("rain"); }
        if ((flags & Reading.FLAG_SRAD) != 0) { out.add("srad"); }
        if ((flags & Reading.FLAG_RH)   != 0) { out.add("rh"); }
        if ((flags & Reading.FLAG_WIND) != 0) { out.add("wind"); }
        return out;
    }
}
