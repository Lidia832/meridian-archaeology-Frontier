package ca.meridian.util;

import java.util.ArrayList;
import java.util.List;

/**
 * String odds and ends. Predates having any dependency to lean on.
 *
 * A. Okonkwo, 2014-10
 */
public final class Strings {

    private Strings() {
    }

    public static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    public static boolean notBlank(String s) {
        return !isBlank(s);
    }

    public static String orEmpty(String s) {
        return s == null ? "" : s;
    }

    public static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** Uppercases and strips a station id the way the old portal did. */
    public static String normStation(String s) {
        if (s == null) {
            return null;
        }
        return s.trim().toUpperCase();
    }

    public static String join(List<String> parts, String sep) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.size(); i++) {
            if (i > 0) {
                sb.append(sep);
            }
            sb.append(parts.get(i));
        }
        return sb.toString();
    }

    public static List<String> split(String s, char sep) {
        List<String> out = new ArrayList<>();
        if (s == null || s.isEmpty()) {
            return out;
        }
        int start = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == sep) {
                out.add(s.substring(start, i));
                start = i + 1;
            }
        }
        out.add(s.substring(start));
        return out;
    }

    public static String repeat(String s, int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            sb.append(s);
        }
        return sb.toString();
    }

    public static String padRight(String s, int width) {
        s = orEmpty(s);
        if (s.length() >= width) {
            return s;
        }
        return s + repeat(" ", width - s.length());
    }

    /** Very small percent-decoder for query values. */
    public static String urlDecode(String s) {
        if (s == null || s.indexOf('%') < 0 && s.indexOf('+') < 0) {
            return s;
        }
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '+') {
                sb.append(' ');
            } else if (c == '%' && i + 2 < s.length()) {
                int hi = Character.digit(s.charAt(i + 1), 16);
                int lo = Character.digit(s.charAt(i + 2), 16);
                if (hi >= 0 && lo >= 0) {
                    sb.append((char) ((hi << 4) + lo));
                    i += 2;
                } else {
                    sb.append(c);
                }
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
