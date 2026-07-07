package dsaviz;

/** Traced read-only string with two-pointer compare visualization. */
public final class TracedString {
    private final String id;
    private final String s;

    public TracedString(String name, String s) {
        this.id = Tracer.register(name);
        this.s = s;
        Tracer.emit("string_init", id, new Tracer.J().num("length", s.length()).str("value", s).end());
    }

    /** Read the char at i. Pure metadata — no event. */
    public char at(int i) { return s.charAt(i); }

    /** Emit string_compare for i and j; return whether they match. */
    public boolean compare(int i, int j) {
        boolean match = s.charAt(i) == s.charAt(j);
        Tracer.emit("string_compare", id, new Tracer.J()
            .num("indexA", i).num("indexB", j)
            .str("charA", String.valueOf(s.charAt(i)))
            .str("charB", String.valueOf(s.charAt(j)))
            .bool("isMatch", match)
            .end());
        return match;
    }

    public int len() { return s.length(); }
}
