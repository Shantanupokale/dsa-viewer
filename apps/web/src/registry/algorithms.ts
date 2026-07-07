/**
 * Algorithm Registry (PRD §10.1) — DATA, not code. Adding an algorithm that reuses an
 * existing plugin is a single entry here, zero renderer changes. Phase 0 ships two Go
 * examples, both on the `sequence` plugin, to prove that reuse.
 */
export type Language = "go" | "java" | "cpp";

export interface AlgorithmDescriptor {
  id: string;
  displayName: string;
  language: Language;
  primaryPlugin: string;
  secondaryPanels: string[];
  defaultCode: string;
}

const BUBBLE_SORT_GO = `package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"

	"dsaviz/tracer"
)

func main() {
	nums := readInts(os.Stdin)
	if len(nums) == 0 {
		nums = []int{5, 2, 9, 1, 5, 6}
	}

	arr := tracer.NewArray("nums", nums)
	n := arr.Len()
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-1-i; j++ {
			if arr.Get(j) > arr.Get(j+1) {
				arr.Swap(j, j+1)
			}
		}
	}
	fmt.Println("done")
}

func readInts(r *os.File) []int {
	s := bufio.NewScanner(r)
	s.Split(bufio.ScanWords)
	var out []int
	for s.Scan() {
		if v, err := strconv.Atoi(s.Text()); err == nil {
			out = append(out, v)
		}
	}
	return out
}
`;

const REVERSE_ARRAY_GO = `package main

import (
	"fmt"

	"dsaviz/tracer"
)

func main() {
	arr := tracer.NewArray("nums", []int{1, 2, 3, 4, 5, 6})
	i, j := 0, arr.Len()-1
	for i < j {
		arr.Swap(i, j)
		i++
		j--
	}
	fmt.Println("reversed")
}
`;

const NEXT_GREATER_GO = `package main

import (
	"fmt"

	"dsaviz/tracer"
)

// Next greater element — monotonic stack of values.
func main() {
	arr := tracer.NewArray("nums", []int{2, 1, 5, 3, 6, 4})
	stack := tracer.NewStack("stack")
	for i := 0; i < arr.Len(); i++ {
		x := arr.Get(i)
		for !stack.Empty() && stack.Peek() < x {
			stack.Pop()
		}
		stack.Push(x)
	}
	fmt.Println("done")
}
`;

const VALID_PARENS_GO = `package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"dsaviz/tracer"
)

// Valid parentheses. Note: the stack shows ASCII codes of the bracket chars.
func main() {
	s := readLine(os.Stdin)
	if s == "" {
		s = "([]{})"
	}
	stack := tracer.NewStack("stack")
	ok := true
	match := map[byte]byte{')': '(', ']': '[', '}': '{'}
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch c {
		case '(', '[', '{':
			stack.Push(int(c))
		case ')', ']', '}':
			if stack.Empty() || stack.Pop() != int(match[c]) {
				ok = false
			}
		}
	}
	if !stack.Empty() {
		ok = false
	}
	fmt.Println("valid:", ok)
}

func readLine(f *os.File) string {
	sc := bufio.NewScanner(f)
	if sc.Scan() {
		return strings.TrimSpace(sc.Text())
	}
	return ""
}
`;

const SLIDING_WINDOW_GO = `package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"

	"dsaviz/tracer"
)

// Sliding window maximum — a deque of indices (front = current max) over an array.
func main() {
	nums := readInts(os.Stdin)
	if len(nums) == 0 {
		nums = []int{1, 3, -1, -3, 5, 3, 6, 7}
	}
	const k = 3

	arr := tracer.NewArray("nums", nums)
	window := tracer.NewDeque("window") // holds indices

	for i := 0; i < arr.Len(); i++ {
		for !window.Empty() && arr.Get(window.Back()) <= arr.Get(i) {
			window.PopBack()
		}
		window.PushBack(i)
		if window.Front() <= i-k {
			window.PopFront()
		}
	}
	fmt.Println("done")
}

func readInts(r *os.File) []int {
	s := bufio.NewScanner(r)
	s.Split(bufio.ScanWords)
	var out []int
	for s.Scan() {
		if v, err := strconv.Atoi(s.Text()); err == nil {
			out = append(out, v)
		}
	}
	return out
}
`;

export const algorithms: AlgorithmDescriptor[] = [
  {
    id: "bubble-sort",
    displayName: "Bubble sort (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: BUBBLE_SORT_GO,
  },
  {
    id: "reverse-array",
    displayName: "Reverse array — two pointers (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: REVERSE_ARRAY_GO,
  },
  {
    id: "next-greater-element",
    displayName: "Next greater element — stack (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: NEXT_GREATER_GO,
  },
  {
    id: "valid-parentheses",
    displayName: "Valid parentheses — stack (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: VALID_PARENS_GO,
  },
  {
    id: "sliding-window-maximum",
    displayName: "Sliding window maximum — deque + array (Go)",
    language: "go",
    primaryPlugin: "sequence",
    secondaryPanels: ["variables"],
    defaultCode: SLIDING_WINDOW_GO,
  },
];

export function getAlgorithm(id: string): AlgorithmDescriptor | undefined {
  return algorithms.find((a) => a.id === id);
}
