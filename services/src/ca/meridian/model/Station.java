package ca.meridian.model;

/**
 * A weather/trial station and its coverage in the reading store.
 *
 * The network has six sites: GUELPH, KITCHNER, WATERLOO, CAMBRIDG,
 * MILTON, BRANTFRD. The truncated eight-char ids are a holdover from
 * the original fixed-width station file and are kept as the primary
 * key everywhere downstream.
 *
 * A. Okonkwo, 2015-03
 */
public final class Station {

    public final String id;
    public final long days;
    public final int firstYear;
    public final int lastYear;

    public Station(String id, long days, int firstYear, int lastYear) {
        this.id = id;
        this.days = days;
        this.firstYear = firstYear;
        this.lastYear = lastYear;
    }

    public int years() {
        if (firstYear == 0 || lastYear == 0) {
            return 0;
        }
        return (lastYear - firstYear) + 1;
    }

    @Override
    public String toString() {
        return "Station{" + id + ", days=" + days
                + ", " + firstYear + "-" + lastYear + "}";
    }
}
