package ca.meridian.api;

import ca.meridian.db.Db;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** GET /api/series?station=XXX&year=YYYY - daily model output. */
public final class SeriesHandler implements HttpHandler {

    private final Db db;

    public SeriesHandler(Db db) {
        this.db = db;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        Map<String, String> q = ForecastHandler.parseQuery(ex.getRequestURI().getRawQuery());
        String station = q.get("station");
        String year = q.get("year");

        if (station == null || year == null) {
            ApiServer.sendError(ex, 400, "station and year are required");
            return;
        }

        int y;
        try {
            y = Integer.parseInt(year);
        } catch (NumberFormatException nfe) {
            ApiServer.sendError(ex, 400, "year must be an integer");
            return;
        }

        String sql = "SELECT doy, sw, et, drain, biom, lai FROM forecast_daily"
                   + " WHERE stnid = '" + station + "' AND year = " + y
                   + " ORDER BY doy";

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
