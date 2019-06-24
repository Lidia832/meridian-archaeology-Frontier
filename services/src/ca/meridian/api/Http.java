package ca.meridian.api;

import ca.meridian.util.Strings;
import com.sun.net.httpserver.HttpExchange;

import java.util.HashMap;
import java.util.Map;

/**
 * Small request-side helpers shared by the newer handlers.
 *
 * The query parser mirrors ForecastHandler.parseQuery so the two
 * families of endpoints agree on the param names (station, year -
 * never stn), but this one also percent-decodes the value, which the
 * older one does not. Kept separate rather than changing the original
 * to avoid touching a legacy code path under test elsewhere.
 *
 * D. Iqbal 2021
 */
public final class Http {

    private Http() {
    }

    public static Map<String, String> query(HttpExchange ex) {
        return parse(ex.getRequestURI().getRawQuery());
    }

    public static Map<String, String> parse(String raw) {
        Map<String, String> q = new HashMap<>();
        if (Strings.isBlank(raw)) {
            return q;
        }
        for (String pair : raw.split("&")) {
            int i = pair.indexOf('=');
            if (i > 0) {
                String k = pair.substring(0, i);
                String v = Strings.urlDecode(pair.substring(i + 1));
                q.put(k, v);
            } else if (i < 0 && !pair.isEmpty()) {
                q.put(pair, "");
            }
        }
        return q;
    }

    public static boolean isGet(HttpExchange ex) {
        return "GET".equalsIgnoreCase(ex.getRequestMethod());
    }

    public static String param(Map<String, String> q, String name) {
        return Strings.trimToNull(q.get(name));
    }
}
