package ca.meridian.api;

import com.sun.net.httpserver.Filter;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * Registration helper for the newer contexts.
 *
 * The 2017 reduction to the JDK server wired the four original routes
 * up by hand in ApiServer, each with its own inline response code. As
 * more endpoints landed that got repetitive, so this collects the
 * common wiring: attach the shared filters (request log, CORS) and
 * remember the path so RootHandler can advertise it. The legacy routes
 * are still registered the old way in ApiServer and are listed here
 * only for the route index.
 *
 * D. Iqbal 2021
 */
public final class Router {

    /** A registered route, for the /api index. */
    public static final class Route {
        public final String path;
        public final String summary;

        public Route(String path, String summary) {
            this.path = path;
            this.summary = summary;
        }
    }

    private final HttpServer server;
    private final List<Route> routes = new ArrayList<>();
    private final List<Filter> filters = new ArrayList<>();

    public Router(HttpServer server) {
        this.server = server;
    }

    public Router withFilters(Filter... fs) {
        filters.addAll(Arrays.asList(fs));
        return this;
    }

    /** Registers a filtered context and records it for the route index. */
    public Router add(String path, String summary, HttpHandler handler) {
        com.sun.net.httpserver.HttpContext ctx = server.createContext(path, handler);
        ctx.getFilters().addAll(filters);
        routes.add(new Route(path, summary));
        return this;
    }

    /** Records a route that is wired up elsewhere (the legacy handlers). */
    public Router note(String path, String summary) {
        routes.add(new Route(path, summary));
        return this;
    }

    public List<Route> routes() {
        Collections.sort(routes, (a, b) -> a.path.compareTo(b.path));
        return routes;
    }
}
