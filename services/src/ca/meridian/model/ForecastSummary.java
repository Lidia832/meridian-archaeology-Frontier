package ca.meridian.model;

/**
 * Aggregate yield figures for a station, used by /api/summary.
 *
 * S. Whitfield 2019
 */
public final class ForecastSummary {

    public final String station;
    public final int runs;
    public final double meanYield;
    public final double minYield;
    public final double maxYield;
    public final int firstYear;
    public final int lastYear;

    public ForecastSummary(String station, int runs, double meanYield,
                           double minYield, double maxYield,
                           int firstYear, int lastYear) {
        this.station = station;
        this.runs = runs;
        this.meanYield = meanYield;
        this.minYield = minYield;
        this.maxYield = maxYield;
        this.firstYear = firstYear;
        this.lastYear = lastYear;
    }

    public double spread() {
        return maxYield - minYield;
    }
}
