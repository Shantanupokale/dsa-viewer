package dsaviz;

import java.util.ArrayDeque;

/** Traced double-ended queue of ints: push/pop at either end. */
public final class Deque {
    private final String id;
    private final ArrayDeque<Integer> data = new ArrayDeque<>();

    public Deque(String name) { this.id = Tracer.register(name); }

    public void pushFront(int v) {
        data.addFirst(v);
        Tracer.emit("deque_push_front", id, new Tracer.J().num("value", v).end());
    }

    public void pushBack(int v) {
        data.addLast(v);
        Tracer.emit("deque_push_back", id, new Tracer.J().num("value", v).end());
    }

    public int popFront() {
        int v = data.removeFirst();
        Tracer.emit("deque_pop_front", id, new Tracer.J().num("value", v).end());
        return v;
    }

    public int popBack() {
        int v = data.removeLast();
        Tracer.emit("deque_pop_back", id, new Tracer.J().num("value", v).end());
        return v;
    }

    // Front/Back read an end without mutating — pure metadata, no event.
    public int front() { return data.peekFirst(); }
    public int back() { return data.peekLast(); }
    public boolean empty() { return data.isEmpty(); }
    public int len() { return data.size(); }
}
