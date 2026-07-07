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
];

export function getAlgorithm(id: string): AlgorithmDescriptor | undefined {
  return algorithms.find((a) => a.id === id);
}
