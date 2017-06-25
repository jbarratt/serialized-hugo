package main

import (
	"fmt"
	"time"

	"github.com/tsenart/vegeta/lib"
)

func testRate(rate int, sla time.Duration) bool {
	duration := 15 * time.Second
	targeter := vegeta.NewStaticTargeter(vegeta.Target{
		Method: "GET",
		URL:    "http://localhost:8755/",
	})
	attacker := vegeta.NewAttacker()
	var metrics vegeta.Metrics
	for res := range attacker.Attack(targeter, uint64(rate), duration) {
		metrics.Add(res)
	}
	metrics.Close()
	latency := metrics.Latencies.P95
	if latency > sla {
		fmt.Printf("💥  Failed at %d req/sec (latency %s)\n", rate, latency)
		return false
	}
	fmt.Printf("✨  Success at %d req/sec (latency %s)\n", rate, latency)
	return true
}

func main() {
	rate := 20
	okRate := 1
	var nokRate int
	sla := 1 * time.Second

	// first, find the point at which the system breaks
	for {
		if testRate(rate, sla) {
			okRate = rate
			rate *= 2
		} else {
			nokRate = rate
			break
		}
	}

	// next, do a binary search between okRate and nokRate
	for (nokRate - okRate) > 1 {
		rate = (nokRate + okRate) / 2
		if testRate(rate, sla) {
			okRate = rate
		} else {
			nokRate = rate
		}
	}
	fmt.Printf("➡️  Maximum Working Rate: %d req/sec\n", okRate)
}
