package ca.meridian.api;

import ca.meridian.db.Db;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** GET /api/stations - list of stations with their record counts. */
public final class StationHandler implements HttpHandler {

    private final Db db;

    public StationHandler(Db db) {
        this.db = db;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        String json;
        try {
            json = db.queryJson(
                "SELECT stnid, COUNT(*) AS days, MIN(year) AS first_year,"
                + " MAX(year) AS last_year FROM reading GROUP BY stnid ORDER BY stnid");
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
