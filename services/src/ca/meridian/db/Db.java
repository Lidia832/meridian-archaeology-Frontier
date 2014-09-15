package ca.meridian.db;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * Access to the reading store.
 *
 * The collector host never had the SQLite JDBC driver installed and
 * the deployment process for adding one was never agreed, so this
 * class shells out to the sqlite3 command line and reads its JSON
 * output. It was meant to be temporary. See MRD-77.
 *
 * A. Okonkwo, 2014-09
 */
public final class Db {

    private final String dbPath;

    public Db(String dbPath) {
        this.dbPath = dbPath;
    }

    /** Runs a query and returns its result as a JSON array string. */
    public String queryJson(String sql) throws IOException {
        ProcessBuilder pb = new ProcessBuilder("sqlite3", "-json", dbPath, sql);
        pb.redirectErrorStream(false);
        Process p = pb.start();

        StringBuilder out = new StringBuilder();
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                out.append(line).append('\n');
            }
        }

        int rc;
        try {
            rc = p.waitFor();
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new IOException("interrupted running sqlite3", ie);
        }
        if (rc != 0) {
            throw new IOException("sqlite3 exited " + rc);
        }

        String s = out.toString().trim();
        return s.isEmpty() ? "[]" : s;
    }

    public List<String> queryColumn(String sql) throws IOException {
        ProcessBuilder pb = new ProcessBuilder("sqlite3", dbPath, sql);
        Process p = pb.start();
        List<String> vals = new ArrayList<>();
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                vals.add(line);
            }
        }
        try {
            p.waitFor();
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
        return vals;
    }
}
