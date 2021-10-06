package ca.meridian.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A small JSON reader and writer.
 *
 * Meridian has never had a JSON library on the classpath. For years
 * the handlers just streamed the sqlite3 -json output straight to the
 * client, which is why the older endpoints do no parsing at all. When
 * the aggregate endpoints arrived in 2019 they needed to actually read
 * the rows back, so this went in. It handles the subset sqlite3 emits:
 * arrays of flat objects whose values are strings, numbers, booleans
 * or null. It is not a general JSON library and does not try to be.
 *
 * S. Whitfield 2019
 */
public final class TinyJson {

    private TinyJson() {
    }

    // ---- parsing -------------------------------------------------------

    /** Parses a JSON array of objects into a list of maps. */
    @SuppressWarnings("unchecked")
    public static List<Map<String, Object>> parseRows(String json) {
        Object v = parse(json);
        List<Map<String, Object>> rows = new ArrayList<>();
        if (v instanceof List) {
            for (Object o : (List<Object>) v) {
                if (o instanceof Map) {
                    rows.add((Map<String, Object>) o);
                }
            }
        }
        return rows;
    }

    public static Object parse(String json) {
        if (json == null) {
            return null;
        }
        Parser p = new Parser(json);
        p.ws();
        Object v = p.value();
        p.ws();
        return v;
    }

    private static final class Parser {
        private final String s;
        private int i;

        Parser(String s) {
            this.s = s;
        }

        void ws() {
            while (i < s.length()) {
                char c = s.charAt(i);
                if (c == ' ' || c == '\n' || c == '\r' || c == '\t') {
                    i++;
                } else {
                    break;
                }
            }
        }

        Object value() {
            if (i >= s.length()) {
                return null;
            }
            char c = s.charAt(i);
            switch (c) {
                case '{':
                    return object();
                case '[':
                    return array();
                case '"':
                    return string();
                case 't':
                case 'f':
                    return bool();
                case 'n':
                    return nul();
                default:
                    return number();
            }
        }

        Map<String, Object> object() {
            Map<String, Object> m = new LinkedHashMap<>();
            expect('{');
            ws();
            if (peek() == '}') {
                i++;
                return m;
            }
            while (true) {
                ws();
                String key = string();
                ws();
                expect(':');
                ws();
                m.put(key, value());
                ws();
                char c = next();
                if (c == '}') {
                    break;
                }
                if (c != ',') {
                    throw err("expected , or } in object");
                }
            }
            return m;
        }

        List<Object> array() {
            List<Object> a = new ArrayList<>();
            expect('[');
            ws();
            if (peek() == ']') {
                i++;
                return a;
            }
            while (true) {
                ws();
                a.add(value());
                ws();
                char c = next();
                if (c == ']') {
                    break;
                }
                if (c != ',') {
                    throw err("expected , or ] in array");
                }
            }
            return a;
        }

        String string() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (i < s.length()) {
                char c = s.charAt(i++);
                if (c == '"') {
                    return sb.toString();
                }
                if (c == '\\') {
                    char e = s.charAt(i++);
                    switch (e) {
                        case '"': sb.append('"'); break;
                        case '\\': sb.append('\\'); break;
                        case '/': sb.append('/'); break;
                        case 'b': sb.append('\b'); break;
                        case 'f': sb.append('\f'); break;
                        case 'n': sb.append('\n'); break;
                        case 'r': sb.append('\r'); break;
                        case 't': sb.append('\t'); break;
                        case 'u':
                            String hex = s.substring(i, i + 4);
                            sb.append((char) Integer.parseInt(hex, 16));
                            i += 4;
                            break;
                        default:
                            sb.append(e);
                    }
                } else {
                    sb.append(c);
                }
            }
            throw err("unterminated string");
        }

        Object number() {
            int start = i;
            while (i < s.length()) {
                char c = s.charAt(i);
                if ((c >= '0' && c <= '9') || c == '-' || c == '+'
                        || c == '.' || c == 'e' || c == 'E') {
                    i++;
                } else {
                    break;
                }
            }
            String tok = s.substring(start, i);
            if (tok.indexOf('.') >= 0 || tok.indexOf('e') >= 0 || tok.indexOf('E') >= 0) {
                return Double.parseDouble(tok);
            }
            try {
                return Long.parseLong(tok);
            } catch (NumberFormatException nfe) {
                return Double.parseDouble(tok);
            }
        }

        Boolean bool() {
            if (s.startsWith("true", i)) {
                i += 4;
                return Boolean.TRUE;
            }
            if (s.startsWith("false", i)) {
                i += 5;
                return Boolean.FALSE;
            }
            throw err("bad literal");
        }

        Object nul() {
            if (s.startsWith("null", i)) {
                i += 4;
                return null;
            }
            throw err("bad literal");
        }

        char peek() {
            return i < s.length() ? s.charAt(i) : '\0';
        }

        char next() {
            return i < s.length() ? s.charAt(i++) : '\0';
        }

        void expect(char c) {
            if (next() != c) {
                throw err("expected " + c);
            }
        }

        RuntimeException err(String msg) {
            return new IllegalArgumentException("json: " + msg + " at " + i);
        }
    }

    // ---- writing -------------------------------------------------------

    public static String escape(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                case '\b': sb.append("\\b"); break;
                case '\f': sb.append("\\f"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        return sb.toString();
    }

    public static void writeValue(StringBuilder sb, Object v) {
        if (v == null) {
            sb.append("null");
        } else if (v instanceof String) {
            sb.append('"').append(escape((String) v)).append('"');
        } else if (v instanceof Number || v instanceof Boolean) {
            sb.append(v.toString());
        } else if (v instanceof Map) {
            writeObject(sb, (Map<?, ?>) v);
        } else if (v instanceof Iterable) {
            writeArray(sb, (Iterable<?>) v);
        } else {
            sb.append('"').append(escape(v.toString())).append('"');
        }
    }

    public static void writeObject(StringBuilder sb, Map<?, ?> m) {
        sb.append('{');
        boolean first = true;
        for (Map.Entry<?, ?> e : m.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(escape(String.valueOf(e.getKey()))).append('"').append(':');
            writeValue(sb, e.getValue());
        }
        sb.append('}');
    }

    public static void writeArray(StringBuilder sb, Iterable<?> it) {
        sb.append('[');
        boolean first = true;
        for (Object o : it) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeValue(sb, o);
        }
        sb.append(']');
    }

    public static String write(Object v) {
        StringBuilder sb = new StringBuilder();
        writeValue(sb, v);
        return sb.toString();
    }
}
