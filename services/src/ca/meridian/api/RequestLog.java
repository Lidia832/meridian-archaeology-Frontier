package ca.meridian.api;

import ca.meridian.util.Clock;
import ca.meridian.util.Env;
import com.sun.net.httpserver.Filter;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;

/**
 * Per-request logging and metrics filter.
 *
 * Attached to the newer contexts. It times the request, feeds the
 * counter in {@link Metrics}, and - only when meridian.log is on -
 * prints a one-line access record to stdout in the rough combined-log
 * shape the old Apache in front of the 2014 app used to emit. There is
 * no logging framework; there never has been.
 *
 * D. Iqbal 2021
 */
public final class RequestLog extends Filter {

    @Override
    public String description() {
        return "request logging and metrics";
    }

    @Override
    public void doFilter(HttpExchange ex, Chain chain) throws IOException {
        long start = Clock.nowMillis();
        int status = 0;
        try {
            chain.doFilter(ex);
            status = ex.getResponseCode();
            if (status <= 0) {
                status = 200;
            }
        } catch (IOException | RuntimeException e) {
            status = 500;
            throw e;
        } finally {
            String path = ex.getRequestURI().getPath();
            Metrics.record(path, status);
            if (Env.logEnabled()) {
                long ms = Clock.since(start);
                String q = ex.getRequestURI().getRawQuery();
                System.out.println(Clock.isoUtc()
                        + " " + ex.getRequestMethod()
                        + " " + path + (q == null ? "" : "?" + q)
                        + " -> " + status
                        + " " + ms + "ms");
            }
        }
    }
}
