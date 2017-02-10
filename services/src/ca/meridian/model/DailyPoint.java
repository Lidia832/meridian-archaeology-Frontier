package ca.meridian.model;

/**
 * One day of daily model output (from forecast_daily).
 *
 * Columns: sw soil water, et evapotranspiration, drain drainage,
 * biom biomass, lai leaf area index. Units are whatever the crop
 * model wrote; the service layer never converted them.
 *
 * S. Whitfield 2019
 */
public final class DailyPoint {

    public final int doy;
    public final double sw;
    public final double et;
    public final double drain;
    public final double biom;
    public final double lai;

    public DailyPoint(int doy, double sw, double et, double drain,
                      double biom, double lai) {
        this.doy = doy;
        this.sw = sw;
        this.et = et;
        this.drain = drain;
        this.biom = biom;
        this.lai = lai;
    }
}
