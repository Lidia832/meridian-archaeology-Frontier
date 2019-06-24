package ca.meridian.api;

import ca.meridian.db.DbClient;
import ca.meridian.db.QueryBuilder;
import ca.meridian.db.ResultSetLite;
import ca.meridian.db.Row;
import ca.meridian.util.Clock;
import ca.meridian.util.Csv;
import ca.meridian.util.Strings;
import ca.meridian.util.Validate;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * GET /api/export?table=readings|forecast|series&station=XXX&year=YYYY
 *
 * CSV download for the spreadsheet crowd. The table param picks the
 * source; readings and series require a station (and series a year)
 * because the raw tables are large. The filename carries the table,
 * station and date so downloads do not collide in the Downloads
 * folder. Values come back through QueryBuilder, so unlike the JSON
 * data endpoints the station filter here is validated.
 *
 * S. Whitfield 2019
 */
public final class ExportHandler implements HttpHandler {

    private final DbClient db;

    public ExportHandler(DbClient db) {
        this.db = db;
    }

    @Override
    public void handle(HttpExchange ex) throws IOException {
        if (!Http.isGet(ex)) {
            Errors.methodNotAllowed(ex);
            return;
        }
        Map<String, String> q = Http.query(ex);
        String table = Strings.orEmpty(Http.param(q, "table")).toLowerCase();
        if (table.isEmpty()) {
            table = "forecast";
        }

        List<String> columns;
        QueryBuilder qb;
        String station = null;
        Integer year;
        try {
            String stationRaw = Http.param(q, "station");
            station = Strings.notBlank(stationRaw) ? Validate.requireStation(stationRaw) : null;
            year = Validate.optionalYear(Http.param(q, "year"));

            switch (table) {
                case "forecast":
                    columns = Arrays.asList("stnid", "year", "yield_t", "ndays", "model", "run_at");
                    qb = QueryBuilder.select(columns.toArray(new String[0])).from("forecast");
                    if (station != null) {
                        qb.whereEq("stnid", station);
                    }
                    if (year != null) {
                        qb.whereEq("year", year);
                    }
                    qb.orderBy("stnid", "year");
                    break;
                case "readings":
                    if (station == null) {
                        Errors.badRequest(ex, "station is required for a readings export");
                        return;
                    }
                    columns = Arrays.asList("stnid", "year", "doy", "tmax", "tmin",
                            "rain", "srad", "rh", "wind", "flags");
                    qb = QueryBuilder.select(columns.toArray(new String[0])).from("reading")
                            .whereEq("stnid", station);
                    if (year != null) {
                        qb.whereEq("year", year);
                    }
                    qb.orderBy("year", "doy");
                    break;
                case "series":
                    if (station == null || year == null) {
                        Errors.badRequest(ex, "station and year are required for a series export");
                        return;
                    }
                    columns = Arrays.asList("doy", "sw", "et", "drain", "biom", "lai");
                    qb = QueryBuilder.select(columns.toArray(new String[0]))
                            .from("forecast_daily")
                            .whereEq("stnid", station)
                            .whereEq("year", year)
                            .orderBy("doy");
                    break;
                default:
                    Errors.badRequest(ex, "unknown table: " + table);
                    return;
            }
        } catch (Validate.BadRequest br) {
            Errors.badRequest(ex, br.getMessage());
            return;
        }

        ResultSetLite rs;
        try {
            rs = db.query(qb);
        } catch (IOException e) {
            Errors.serverError(ex, e.getMessage());
            return;
        }

        List<Map<String, Object>> rows = new ArrayList<>(rs.size());
        for (Row r : rs) {
            rows.add(r.asMap());
        }
        String csv = Csv.fromRows(columns, rows);

        String fname = "meridian_" + table
                + (station == null ? "" : "_" + station)
                + (year == null ? "" : "_" + year)
                + "_" + Clock.stampDay() + ".csv";

        ex.getResponseHeaders().add("Content-Type", "text/csv; charset=utf-8");
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().add("Content-Disposition",
                "attachment; filename=\"" + fname + "\"");
        byte[] body = csv.getBytes(StandardCharsets.UTF_8);
        ex.sendResponseHeaders(200, body.length);
        try (java.io.OutputStream os = ex.getResponseBody()) {
            os.write(body);
        }
    }
}
