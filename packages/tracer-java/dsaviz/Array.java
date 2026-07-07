package dsaviz;

/** Traced int array. Reads, writes, and swaps are visualized. */
public final class Array {
    private final String id;
    private final int[] data;

    public Array(String name, int[] initial) {
        this.id = Tracer.register(name);
        this.data = initial.clone();
        Tracer.emit("array_init", id, new Tracer.J().num("length", data.length).intArray("initialValues", data).end());
    }

    public int get(int i) {
        Tracer.emit("array_read", id, new Tracer.J().num("index", i).num("value", data[i]).end());
        return data[i];
    }

    public void set(int i, int v) {
        int old = data[i];
        data[i] = v;
        Tracer.emit("array_write", id, new Tracer.J().num("index", i).num("oldValue", old).num("newValue", v).end());
    }

    public void swap(int i, int j) {
        int t = data[i];
        data[i] = data[j];
        data[j] = t;
        Tracer.emit("array_swap", id, new Tracer.J().num("indexA", i).num("indexB", j).end());
    }

    public int len() { return data.length; }
}
