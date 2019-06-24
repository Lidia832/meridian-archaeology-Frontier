package ca.meridian.api;

import ca.meridian.db.DbClient;
import ca.meridian.db.QueryBuilder;
import ca.meridian.db.ResultSetLite;
import ca.meridian.db.Row;
import ca.meridian.model.ForecastSummary;
import ca.meridian.util.Numbers;
import ca.meridian.util.Strings;
import ca.meridian.util.TinyJson;
import ca.meridian.util.Validate;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api/summary               - one summary row per station
 * GET /api/summary?station=XXX   - just that station
 *
 * Aggregates the forecast table into per-station yield statistics for
 * the portal's overview cards. Unlike the two original data endpoints,
 * the station filter here is validated and quoted through QueryBuilder
 * (see MRD-166, which this endpoint deliberately does not repeat).
 *
 * S. Whitfield 2019
 */
public final class SummaryHandler implements HttpHandler {

    private final DbClient db;

    public SummaryHandler(DbClient db) {
        this.db = db;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if (!Http.isGet(ex)) {
            Errors.methodNotAllowed(ex);
            return;
        }
        Map<String, String> q = Http.query(ex);
        String stationRaw = Http.param(q, "station");

        QueryBuilder qb = QueryBuilder.select(
                        "stnid",
                        "COUNT(*) AS runs",
                        "AVG(yield_t) AS mean_yield",
                        "MIN(yield_t) AS min_yield",
                        "MAX(yield_t) AS max_yield",
                        "MIN(year) AS first_year",
                        "MAX(year) AS last_year")
                .from("forecast");

        try {
            if (Strings.notBlank(stationRaw)) {
                String station = Validate.requireStation(stationRaw);
                qb.whereEq("stnid", station);
            }
        } catch (Validate.BadRequest br) {
            Errors.badRequest(ex, br.getMessage());
            return;
        }

        qb.groupBy("stnid").orderBy("stnid");

        ResultSetLite rs;
        try {
            rs = db.query(qb);
        } catch (IOException e) {
            Errors.serverError(ex, e.getMessage());
            return;
        }

        StringBuilder sb = new StringBuilder();
        sb.append('[');
        boolean first = true;
        for (Row r : rs) {
            ForecastSummary s = new ForecastSummary(
                    r.str("stnid"),
                    r.intVal("runs"),
                    r.dbl("mean_yield"),
                    r.dbl("min_yield"),
                    r.dbl("max_yield"),
                    r.intVal("first_year"),
                    r.intVal("last_year"));
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append(toJson(s));
        }
        sb.append(']');
        Json.ok(ex, sb.toString());
    }

    private static String toJson(ForecastSummary s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("station", s.station);
        m.put("runs", s.runs);
        m.put("mean_yield", round(s.meanYield));
        m.put("min_yield", round(s.minYield));
        m.put("max_yield", round(s.maxYield));
        m.put("spread", round(s.spread()));
        m.put("first_year", s.firstYear);
        m.put("last_year", s.lastYear);
        return TinyJson.write(m);
    }

    private static double round(double v) {
        return Numbers.round3(v);
    }

    // kept for the export handler to reuse the same column order
    static List<String> columns() {
        return java.util.Arrays.asList(
                "station", "runs", "mean_yield", "min_yield",
                "max_yield", "spread", "first_year", "last_year");
    }
}
