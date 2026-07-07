package dsaviz;

import java.util.ArrayDeque;

/** Traced FIFO queue of ints: enqueue at rear, dequeue at front. */
public final class Queue {
    private final String id;
    private final ArrayDeque<Integer> data = new ArrayDeque<>();

    public Queue(String name) { this.id = Tracer.register(name); }

    public void enqueue(int v) {
        data.addLast(v);
        Tracer.emit("queue_enqueue", id, new Tracer.J().num("value", v).end());
    }

    public int dequeue() {
        int v = data.removeFirst();
        Tracer.emit("queue_dequeue", id, new Tracer.J().num("value", v).end());
        return v;
    }

    public int peek() {
        int v = data.peekFirst();
        Tracer.emit("queue_peek", id, new Tracer.J().num("value", v).end());
        return v;
    }

    public boolean empty() { return data.isEmpty(); }
    public int len() { return data.size(); }
}
