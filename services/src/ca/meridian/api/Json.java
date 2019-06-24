package ca.meridian.api;

import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Common response helpers.
 *
 * By 2019 every handler was repeating the same four lines - set
 * content type, set the CORS header, send the length, write the
 * bytes. This centralises it. The original handlers were never
 * retro-fitted to use it (they still inline the writes) but everything
 * new goes through here.
 *
 * S. Whitfield 2019
 */
public final class Json {

    private Json() {
    }

    /** Writes a raw JSON string body with 200 OK. */
    public static void ok(HttpExchange ex, String json) throws IOException {
        send(ex, 200, "application/json", json.getBytes(StandardCharsets.UTF_8));
    }

    public static void status(HttpExchange ex, int code, String json) throws IOException {
        send(ex, code, "application/json", json.getBytes(StandardCharsets.UTF_8));
    }

    public static void text(HttpExchange ex, int code, String body) throws IOException {
        send(ex, code, "text/plain; charset=utf-8", body.getBytes(StandardCharsets.UTF_8));
    }

    /** Writes an arbitrary byte body, e.g. a CSV export. */
    public static void bytes(HttpExchange ex, int code, String contentType, byte[] body)
            throws IOException {
        send(ex, code, contentType, body);
    }

    private static void send(HttpExchange ex, int code, String contentType, byte[] body)
            throws IOException {
        ex.getResponseHeaders().add("Content-Type", contentType);
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.sendResponseHeaders(code, body.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(body);
        }
    }
}
