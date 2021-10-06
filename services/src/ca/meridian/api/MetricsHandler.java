package ca.meridian.api;

import ca.meridian.util.TinyJson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GET /api/metrics - in-process request counters.
 *
 * Plain JSON, not the Prometheus text format - there was never a
 * Prometheus to scrape it. Someone SSHed in, curled this, and read the
 * numbers. Counts reset on restart.
 *
 * D. Iqbal 2021
 */
public final class MetricsHandler implements HttpHandler {

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if (!Http.isGet(ex)) {
            Errors.methodNotAllowed(ex);
            return;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("uptime_seconds", Metrics.uptimeSeconds());
        m.put("requests_total", Metrics.total());
        m.put("errors_total", Metrics.errors());
        m.put("by_path", Metrics.byPath());
        m.put("by_status", Metrics.byStatus());
        Json.ok(ex, TinyJson.write(m));
    }
}
