package dsaviz;

import java.util.HashMap;
import java.util.Map;

/**
 * Java tracer SDK core. Emits one line per event to stdout, prefixed with @TRACE@ and
 * followed by JSON matching the @dsa/trace-schema contract. JSON is hand-built (no
 * dependencies) so the sandbox image needs no network at build or run time.
 *
 * Phase 1b implements the Sequence family (Array/Stack/Queue/Deque/TracedString).
 */
public final class Tracer {
    private Tracer() {}

    public static final String TRACE_PREFIX = "@TRACE@";

    private static int step = 0;
    private static final Map<String, Integer> names = new HashMap<>();

    /** Unique structureId for name, auto-suffixing collisions (dp -> dp_2). */
    static synchronized String register(String name) {
        Integer count = names.get(name);
        if (count == null) {
            names.put(name, 1);
            return name;
        }
        int next = count + 1;
        names.put(name, next);
        String suffixed = name + "_" + next;
        System.err.println("tracer: duplicate structure name " + name + ", using " + suffixed);
        return suffixed;
    }

    /** Write one event line. payloadJson must already be a JSON object string. */
    static synchronized void emit(String type, String structureId, String payloadJson) {
        StringBuilder sb = new StringBuilder(TRACE_PREFIX);
        sb.append("{\"step\":").append(step)
          .append(",\"type\":\"").append(type).append('"')
          .append(",\"structureId\":\"").append(esc(structureId)).append('"')
          .append(",\"payload\":").append(payloadJson)
          .append('}');
        System.out.println(sb);
        step++;
    }

    /** Escape a string for embedding in JSON. */
    static String esc(String s) {
        StringBuilder out = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if (c < 0x20) out.append(String.format("\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        return out.toString();
    }

    /** Tiny JSON object builder for payloads. */
    static final class J {
        private final StringBuilder sb = new StringBuilder("{");
        private boolean first = true;

        private void key(String k) {
            if (!first) sb.append(',');
            first = false;
            sb.append('"').append(k).append("\":");
        }

        J num(String k, long v) { key(k); sb.append(v); return this; }
        J bool(String k, boolean v) { key(k); sb.append(v); return this; }
        J str(String k, String v) { key(k); sb.append('"').append(esc(v)).append('"'); return this; }

        J intArray(String k, int[] v) {
            key(k);
            sb.append('[');
            for (int i = 0; i < v.length; i++) {
                if (i > 0) sb.append(',');
                sb.append(v[i]);
            }
            sb.append(']');
            return this;
        }

        String end() { return sb.append('}').toString(); }
    }
}
