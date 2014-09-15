package ca.meridian.api;

import ca.meridian.db.Db;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * GET /api/forecast              - all forecasts
 * GET /api/forecast?station=XXX  - one station's forecast and daily series
 */
public final class ForecastHandler implements HttpHandler {

    private final Db db;

    public ForecastHandler(Db db) {
        this.db = db;
    }

    static Map<String, String> parseQuery(String raw) {
        Map<String, String> q = new HashMap<>();
        if (raw == null || raw.isEmpty()) {
            return q;
        }
        for (String pair : raw.split("&")) {
            int i = pair.indexOf('=');
            if (i > 0) {
                q.put(pair.substring(0, i), pair.substring(i + 1));
            }
        }
        return q;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        Map<String, String> q = parseQuery(ex.getRequestURI().getRawQuery());
        String station = q.get("station");

        String sql;
        if (station == null) {
            sql = "SELECT stnid, year, yield_t, ndays, model, run_at"
                + " FROM forecast ORDER BY stnid, year";
        } else {
            // Station names come from the station list endpoint, so they
            // are known-good. TODO tighten this before the portal opens
            // to external users. MRD-166.
            sql = "SELECT stnid, year, yield_t, ndays, model, run_at"
                + " FROM forecast WHERE stnid = '" + station + "'"
                + " ORDER BY year";
        }

        String json;
        try {
            json = db.queryJson(sql);
        } catch (IOException e) {
            ApiServer.sendError(ex, 500, e.getMessage());
            return;
        }

        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json");
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.sendResponseHeaders(200, body.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(body);
        }
    }
}
