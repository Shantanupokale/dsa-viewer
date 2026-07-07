// tracer.hpp — header-only C++ tracer SDK for the DSA Code Visualizer.
//
// A user writes a normal solution but constructs key structures via this SDK, e.g.
//   tracer::Array arr("nums", {5, 2, 9});
// Each mutating op prints one line to stdout: @TRACE@<json> matching @dsa/trace-schema.
// JSON is hand-built (no dependencies) so the sandbox image needs no network.
//
// Phase 1c implements the Sequence family (Array/Stack/Queue/Deque/TracedString).
#pragma once

#include <cstdio>
#include <deque>
#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace tracer {

inline int g_step = 0;
inline std::unordered_map<std::string, int> g_names;

// Escape a string for embedding in JSON.
inline std::string esc(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char ch : s) {
        switch (ch) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(ch) < 0x20) {
                    char buf[8];
                    std::snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned char>(ch));
                    out += buf;
                } else {
                    out += ch;
                }
        }
    }
    return out;
}

// Unique structureId for name, auto-suffixing collisions (dp -> dp_2).
inline std::string reg(const std::string& name) {
    auto it = g_names.find(name);
    if (it == g_names.end()) {
        g_names[name] = 1;
        return name;
    }
    int next = ++it->second;
    std::string suffixed = name + "_" + std::to_string(next);
    std::cerr << "tracer: duplicate structure name " << name << ", using " << suffixed << "\n";
    return suffixed;
}

// Write one event line. payload must already be a JSON object string.
inline void emit(const std::string& type, const std::string& id, const std::string& payload) {
    std::cout << "@TRACE@{\"step\":" << g_step << ",\"type\":\"" << type
              << "\",\"structureId\":\"" << esc(id) << "\",\"payload\":" << payload << "}\n";
    ++g_step;
}

// Tiny JSON object builder for payloads.
class J {
    std::ostringstream os_;
    bool first_ = true;
    void key(const std::string& k) {
        if (!first_) os_ << ',';
        first_ = false;
        os_ << '"' << k << "\":";
    }

public:
    J() { os_ << '{'; }
    J& num(const std::string& k, long long v) { key(k); os_ << v; return *this; }
    J& boolean(const std::string& k, bool v) { key(k); os_ << (v ? "true" : "false"); return *this; }
    J& str(const std::string& k, const std::string& v) { key(k); os_ << '"' << esc(v) << '"'; return *this; }
    J& intArray(const std::string& k, const std::vector<int>& v) {
        key(k);
        os_ << '[';
        for (size_t i = 0; i < v.size(); ++i) {
            if (i) os_ << ',';
            os_ << v[i];
        }
        os_ << ']';
        return *this;
    }
    std::string end() { os_ << '}'; return os_.str(); }
};

// ---- Sequence family --------------------------------------------------------

class Array {
    std::string id_;
    std::vector<int> data_;

public:
    Array(const std::string& name, std::vector<int> initial) : id_(reg(name)), data_(std::move(initial)) {
        emit("array_init", id_, J().num("length", (long long)data_.size()).intArray("initialValues", data_).end());
    }
    int get(int i) {
        emit("array_read", id_, J().num("index", i).num("value", data_[i]).end());
        return data_[i];
    }
    void set(int i, int v) {
        int old = data_[i];
        data_[i] = v;
        emit("array_write", id_, J().num("index", i).num("oldValue", old).num("newValue", v).end());
    }
    void swap(int i, int j) {
        std::swap(data_[i], data_[j]);
        emit("array_swap", id_, J().num("indexA", i).num("indexB", j).end());
    }
    int len() const { return (int)data_.size(); }
};

class Stack {
    std::string id_;
    std::vector<int> data_;

public:
    explicit Stack(const std::string& name) : id_(reg(name)) {}
    void push(int v) {
        data_.push_back(v);
        emit("stack_push", id_, J().num("value", v).end());
    }
    int pop() {
        int v = data_.back();
        data_.pop_back();
        emit("stack_pop", id_, J().num("value", v).end());
        return v;
    }
    int peek() {
        int v = data_.back();
        emit("stack_peek", id_, J().num("value", v).end());
        return v;
    }
    bool empty() const { return data_.empty(); }
    int len() const { return (int)data_.size(); }
};

class Queue {
    std::string id_;
    std::deque<int> data_;

public:
    explicit Queue(const std::string& name) : id_(reg(name)) {}
    void enqueue(int v) {
        data_.push_back(v);
        emit("queue_enqueue", id_, J().num("value", v).end());
    }
    int dequeue() {
        int v = data_.front();
        data_.pop_front();
        emit("queue_dequeue", id_, J().num("value", v).end());
        return v;
    }
    int peek() {
        int v = data_.front();
        emit("queue_peek", id_, J().num("value", v).end());
        return v;
    }
    bool empty() const { return data_.empty(); }
    int len() const { return (int)data_.size(); }
};

class Deque {
    std::string id_;
    std::deque<int> data_;

public:
    explicit Deque(const std::string& name) : id_(reg(name)) {}
    void pushFront(int v) {
        data_.push_front(v);
        emit("deque_push_front", id_, J().num("value", v).end());
    }
    void pushBack(int v) {
        data_.push_back(v);
        emit("deque_push_back", id_, J().num("value", v).end());
    }
    int popFront() {
        int v = data_.front();
        data_.pop_front();
        emit("deque_pop_front", id_, J().num("value", v).end());
        return v;
    }
    int popBack() {
        int v = data_.back();
        data_.pop_back();
        emit("deque_pop_back", id_, J().num("value", v).end());
        return v;
    }
    int front() const { return data_.front(); }
    int back() const { return data_.back(); }
    bool empty() const { return data_.empty(); }
    int len() const { return (int)data_.size(); }
};

class TracedString {
    std::string id_;
    std::string s_;

public:
    TracedString(const std::string& name, std::string s) : id_(reg(name)), s_(std::move(s)) {
        emit("string_init", id_, J().num("length", (long long)s_.size()).str("value", s_).end());
    }
    char at(int i) const { return s_[i]; }
    bool compare(int i, int j) {
        bool match = s_[i] == s_[j];
        emit("string_compare", id_,
             J().num("indexA", i).num("indexB", j)
                 .str("charA", std::string(1, s_[i]))
                 .str("charB", std::string(1, s_[j]))
                 .boolean("isMatch", match)
                 .end());
        return match;
    }
    int len() const { return (int)s_.size(); }
};

}  // namespace tracer
