package ca.meridian.api;

import ca.meridian.util.Clock;

import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Process-wide request counters.
 *
 * There was never a metrics backend to ship to - the collector host
 * had no outbound network to speak of - so counts are kept in memory
 * and scraped through /api/metrics when someone is curious. Resets on
 * restart, which is fine; nobody has ever charted these over time.
 *
 * D. Iqbal 2021
 */
public final class Metrics {

    private static final long START_MILLIS = Clock.nowMillis();

    private static final AtomicLong TOTAL = new AtomicLong();
    private static final AtomicLong ERRORS = new AtomicLong();
    private static final Map<String, AtomicLong> BY_PATH = new ConcurrentHashMap<>();
    private static final Map<Integer, AtomicLong> BY_STATUS = new ConcurrentHashMap<>();

    private Metrics() {
    }

    public static void record(String path, int status) {
        TOTAL.incrementAndGet();
        counter(BY_PATH, normalise(path)).incrementAndGet();
        counter(BY_STATUS, status).incrementAndGet();
        if (status >= 500) {
            ERRORS.incrementAndGet();
        }
    }

    public static long total() {
        return TOTAL.get();
    }

    public static long errors() {
        return ERRORS.get();
    }

    public static long uptimeSeconds() {
        return (Clock.nowMillis() - START_MILLIS) / 1000L;
    }

    public static Map<String, Long> byPath() {
        return snapshot(BY_PATH);
    }

    public static Map<String, Long> byStatus() {
        Map<String, Long> out = new TreeMap<>();
        for (Map.Entry<Integer, AtomicLong> e : BY_STATUS.entrySet()) {
            out.put(String.valueOf(e.getKey()), e.getValue().get());
        }
        return out;
    }

    /** Collapses ids so per-station traffic does not explode the map. */
    private static String normalise(String path) {
        if (path == null) {
            return "/";
        }
        int q = path.indexOf('?');
        return q >= 0 ? path.substring(0, q) : path;
    }

    private static <K> AtomicLong counter(Map<K, AtomicLong> m, K key) {
        AtomicLong c = m.get(key);
        if (c == null) {
            c = new AtomicLong();
            AtomicLong prev = m.putIfAbsent(key, c);
            if (prev != null) {
                c = prev;
            }
        }
        return c;
    }

    private static Map<String, Long> snapshot(Map<String, AtomicLong> m) {
        Map<String, Long> out = new TreeMap<>();
        for (Map.Entry<String, AtomicLong> e : m.entrySet()) {
            out.put(e.getKey(), e.getValue().get());
        }
        return out;
    }
}
