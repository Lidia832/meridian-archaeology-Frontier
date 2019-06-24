package ca.meridian.api;

import com.sun.net.httpserver.Filter;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;

/**
 * CORS preflight handling.
 *
 * The original handlers each add "Access-Control-Allow-Origin: *" to
 * their own responses (and still do). What none of them handle is the
 * OPTIONS preflight the portal's fetch() started sending once it added
 * custom headers in 2020. This filter answers OPTIONS directly with
 * the allow headers and 204, and otherwise gets out of the way. Only
 * attached to the newer contexts; the legacy routes never needed it
 * because the old portal used simple GETs.
 *
 * D. Iqbal 2021
 */
public final class Cors extends Filter {

    @Override
    public String description() {
        return "CORS preflight";
    }

    @Override
    public void doFilter(HttpExchange ex, Chain chain) throws IOException {
        if ("OPTIONS".equalsIgnoreCase(ex.getRequestMethod())) {
            ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            ex.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, OPTIONS");
            ex.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
            ex.getResponseHeaders().add("Access-Control-Max-Age", "86400");
            ex.sendResponseHeaders(204, -1);
            ex.close();
            return;
        }
        chain.doFilter(ex);
    }
}
