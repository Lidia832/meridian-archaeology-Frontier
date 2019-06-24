package ca.meridian.api;

import ca.meridian.db.DbClient;
import ca.meridian.db.QueryBuilder;
import ca.meridian.db.ResultSetLite;
import ca.meridian.db.Row;
import ca.meridian.model.Anomaly;
import ca.meridian.util.Strings;
import ca.meridian.util.TinyJson;
import ca.meridian.util.Validate;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GET /api/anomalies?station=XXX&year=YYYY
 *
 * Lists readings the ingest layer flagged as suspect (flags <> 0),
 * with the flag bitset decoded into channel names. Both params are
 * optional; leaving them off scans the whole store, which is why the
 * result is capped. Added when the trial-site agronomists started
 * asking why a station's yield jumped - it was almost always a bad
 * radiation day that had slipped through.
 *
 * D. Iqbal 2021
 */
public final class AnomaliesHandler implements HttpHandler {

    private static final int MAX_ROWS = 2000;

    private final DbClient db;

    public AnomaliesHandler(DbClient db) {
        this.db = db;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if (!Http.isGet(ex)) {
            Errors.methodNotAllowed(ex);
            return;
        }
        Map<String, String> q = Http.query(ex);

        QueryBuilder qb = QueryBuilder.select(
                        "stnid", "year", "doy", "flags")
                .from("reading")
                .whereRaw("flags <> 0");

        try {
            String stationRaw = Http.param(q, "station");
            if (Strings.notBlank(stationRaw)) {
                qb.whereEq("stnid", Validate.requireStation(stationRaw));
            }
            Integer year = Validate.optionalYear(Http.param(q, "year"));
            if (year != null) {
                qb.whereEq("year", year);
            }
        } catch (Validate.BadRequest br) {
            Errors.badRequest(ex, br.getMessage());
            return;
        }

        qb.orderBy("stnid", "year", "doy").limit(MAX_ROWS + 1);

        ResultSetLite rs;
        try {
            rs = db.query(qb);
        } catch (IOException e) {
            Errors.serverError(ex, e.getMessage());
            return;
        }

        boolean truncated = rs.size() > MAX_ROWS;
        int n = truncated ? MAX_ROWS : rs.size();

        StringBuilder items = new StringBuilder();
        items.append('[');
        for (int i = 0; i < n; i++) {
            Row r = rs.get(i);
            Anomaly a = new Anomaly(
                    r.str("stnid"), r.intVal("year"),
                    r.intVal("doy"), r.intVal("flags"));
            if (i > 0) {
                items.append(',');
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("station", a.station);
            m.put("year", a.year);
            m.put("doy", a.doy);
            m.put("flags", a.flags);
            m.put("reasons", a.reasons());
            items.append(TinyJson.write(m));
        }
        items.append(']');

        // splice the pre-rendered array in so reasons stays a real list
        String body = "{\"count\":" + n + ",\"truncated\":" + truncated
                + ",\"anomalies\":" + items + "}";
        Json.ok(ex, body);
    }
}
