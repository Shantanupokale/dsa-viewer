package dsaviz;

import java.util.ArrayList;
import java.util.List;

/** Traced LIFO stack of ints. */
public final class Stack {
    private final String id;
    private final List<Integer> data = new ArrayList<>();

    public Stack(String name) { this.id = Tracer.register(name); }

    public void push(int v) {
        data.add(v);
        Tracer.emit("stack_push", id, new Tracer.J().num("value", v).end());
    }

    public int pop() {
        int v = data.remove(data.size() - 1);
        Tracer.emit("stack_pop", id, new Tracer.J().num("value", v).end());
        return v;
    }

    public int peek() {
        int v = data.get(data.size() - 1);
        Tracer.emit("stack_peek", id, new Tracer.J().num("value", v).end());
        return v;
    }

    public boolean empty() { return data.isEmpty(); }
    public int len() { return data.size(); }
}
