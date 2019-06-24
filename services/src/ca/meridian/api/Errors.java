package ca.meridian.api;

import ca.meridian.util.TinyJson;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;

/**
 * Error envelope helper. Matches the shape ApiServer.sendError has
 * emitted since 2017 - {"error": "..."} - so the portal's error
 * handling did not have to learn a second format when the aggregate
 * endpoints arrived.
 *
 * S. Whitfield 2019
 */
public final class Errors {

    private Errors() {
    }

    public static void send(HttpExchange ex, int code, String message) throws IOException {
        String body = "{\"error\":\"" + TinyJson.escape(message == null ? "" : message) + "\"}";
        Json.status(ex, code, body);
    }

    public static void badRequest(HttpExchange ex, String message) throws IOException {
        send(ex, 400, message);
    }

    public static void notFound(HttpExchange ex, String message) throws IOException {
        send(ex, 404, message);
    }

    public static void serverError(HttpExchange ex, String message) throws IOException {
        send(ex, 500, message);
    }

    public static void methodNotAllowed(HttpExchange ex) throws IOException {
        send(ex, 405, "method not allowed");
    }
}
