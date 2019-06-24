package ca.meridian.api;

import ca.meridian.util.TinyJson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GET /api - a static index of the available routes.
 *
 * There has never been a real docs page for this service; whoever
 * inherited it usually found the routes by grepping ApiServer. This
 * at least lists them. The route table is handed in from the Router so
 * it stays in step with what is actually registered.
 *
 * D. Iqbal 2021
 */
public final class RootHandler implements HttpHandler {

    private final List<Router.Route> routes;

    public RootHandler(List<Router.Route> routes) {
        this.routes = routes;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        // Only answer the exact /api path; the JDK server routes the
        // longest-prefix match here, but we don't want /api to shadow a
        // typo'd /api/foo into a 200.
        String path = ex.getRequestURI().getPath();
        if (!path.equals("/api") && !path.equals("/api/")) {
            Errors.notFound(ex, "no such route: " + path);
            return;
        }

        List<Object> list = new ArrayList<>();
        for (Router.Route r : routes) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("path", r.path);
            m.put("summary", r.summary);
            list.add(m);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", "meridian");
        body.put("version", ApiServer.VERSION);
        body.put("routes", list);
        Json.ok(ex, TinyJson.write(body));
    }
}
