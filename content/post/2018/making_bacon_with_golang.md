---
title: "Making Bacon with Golang"
date: 2018-07-10T21:10:18-07:00
lastmod: 2018-07-10T21:10:18-07:00
description: "Using Go to build out an embeddable and high performance Oracle of Bacon"
summary: "Using Go to build out an embeddable and high performance Oracle of Bacon"
draft: false
---

The [previous post in this series]({{<ref "really_serverless_databases.md">}}) disussed at some length the idea of embedding a database into a Lambda function.

As noted in that post, I enjoy the Kevin Bacon game (which we used to play back in Ye Olde Times from memory), and the classic online version, the [Oracle of Bacon](https://oracleofbacon.org/).

The goal of the game is to be able to take a pair of actor's names, and find the shortest path between them via the films they (or other actors) have been in. The length of this path is the "bacon number".

I knew I wanted to

* Run in a Lambda
* Be written in Go (since it is the best intersection of 'favorite' and 'best performance' under the languages supported by Lambda)
* Have the dataset be < 150MB
* Query with low latency -- less than a network hop, ideally, to test possible performance gains from embedding.

### First Attempt: Cayley

My initial thought was to use [Cayley](https://github.com/cayleygraph/cayley). It's an embeddable graph database, written in Go, which supports a variety of backend stores, including on-disk KVs.

However, I hit a few snags. The README said:

> Rough performance testing shows ... a multi-hop intersection query -- films starring X and Y -- takes ~150ms

I was hoping to have performance significantly better than that, on what I expected to be more challenging queries.

The second thing I noticed was that there was no obvious way to get the shortest path, the single graph operation I most needed. There's even a [closed issue](https://github.com/cayleygraph/cayley/issues/388) from April 2016 about it.

So, back to basics. Though I sadly don't recall everything I learned in my CS classes, I do know that breadth-first search is a good way to find the shortest through an unweighted graph. And, interestingly, I later found the Oracle of Bacon's ["how it works"](https://oracleofbacon.org/how.php) page, which explains that they also use BFS.

### How to do BFS in Go

I'm not a fan of reinventing any wheels I don't need to, so after googling `:allthethings:`, I found a fantastic article by [Egon Elbre](https://medium.com/@egonelbre) called [A Tale of BFS](https://medium.com/@egonelbre/a-tale-of-bfs-4ea1b8ab5eeb). It's an excellent exploration of how to optimize and iteratively improve software, and a true gem given my need for it's ultimate conclusion. Not only does Egon know a lot about graphs and performance improvement, he also [draws gophers](https://github.com/egonelbre/gophers), so he's pretty much the best.

The basic algorithm for BFS is very simple.

![Movie Graph](/images/serverless_db/movie_bfs.svg#center)

* Start at a node. (This will be an actor, for our purposes.)
* Queue up all the nodes connected to your source node. (These will all be movies, labeled as '1st queue')
* Visit them all, collecting any as-yet unvisited node connected to them in a separate queue to visit on the next path. (2nd queue).
* Continue building queues for each 'level' and visiting them until the target node is found, at which point we can halt immediately.

You can halt immediately, because if you see a node, it means you've found (one of the) shortest paths to that node.

Sounds straightforward enough! So, how to represent this data structure in Go?

#### Data Structure

My intuition was to build this with pointers. Each node would be a struct, which had a slice of all it's neighbors, whose members were pointers to node objects. Egon's article pointed out something which in retrospect seems obvious -- this is a terrible idea. Not only do you have to allocate a lot of memory incrementally to build this system, it's also expensive to search, because your CPU-level caching will be very ineffective.

He proposed a different data structure which was new to me: the Compact Adjacency List.

![Compact Adjacency List](/images/serverless_db/compact_adjacency.svg#center)

Every node gets an integer id. There's a slice (`List`) that keeps track of all the neighbors for every node. And there's another slice (`Span`) which, given a node id, returns the offset into the `List` where the neighbors are stored.

```golang
// Graph is the graph storage data
type Graph struct {
	// List is the list of neighbors
	List []Node   `json:"list"`
	Span []uint64 `json:"span"`
}
```

So to find the neighbors of node 4:

* Look up `Span[4]`, which is `8`
* Look up `Span[4+1]`, which is `12`
* This means the neighbors of node `4` are in `List[8:12]`

Easy peasy. No pointers, and highly efficient to serialize, deserialize, and search.

#### Searching the Struct

The code below is very similar to Egon's (including his very clever bitset storage of visited nodes), with one minor extension -- I needed to track the actual path that was taken through the graph.

There's one extra slice for bookkeeping, called `parentNode`. Every time a new neighbor is discovered (meaning it's not already contained in `visited`), store the node id which led to the discovery. For example, the parent node of "Josh Brolin" might be "Avengers: Infinity War", or it might be "True Grit", (or any of his other movies), depending on the path taken to find him.

```golang
for len(currentLevel) > 0 {
		for _, node := range currentLevel {
			for _, neighbor := range g.Neighbors(node) {
				if !visited.Contains(neighbor) {
					nextLevel = append(nextLevel, neighbor)
					visited.Add(neighbor)
					parentNode[neighbor] = node
				}
				if neighbor == dest {
					return NewPath(source, dest, parentNode, b)
				}
			}
		}
    // Sorting the next level to search means we'll search it linearly
    // which will lead to better use of the CPU Cache
		zuint32.SortBYOB(nextLevel, currentLevel[:cap(currentLevel)])

		currentLevel = currentLevel[:0:cap(currentLevel)]
		currentLevel, nextLevel = nextLevel, currentLevel
	}
	return nil, errors.New("No path found")
}
```

When the node that's being searched for is actually discovered, it's a simple matter of starting at `parentNode[target]`, and working backwards until the original source node is found.

![parentNode](/images/serverless_db/parent_node.svg#center)

In the example diagram, the parent of node 5 is 4, so `parentNode[5] == 4`.

#### Making it legible

The next step was converting the paths to a human readable string. (And, in this case, since a target application is Alexa, a string which works well read aloud.)

```
$ ./baconcli path "Tom Hanks" "Benedict Cumberbatch"

Start Node: {Tom Hanks true 31 3543}
End Node: {Benedict Cumberbatch true 71580 48}

2018/07/11 08:13:54 Search took 1.396419ms

Benedict Cumberbatch and Tom Hanks are separated by 2 degrees. Benedict Cumberbatch was in "Avengers: Infinity War" with Paul Bettany, who was in "The Da Vinci Code" with Tom Hanks
```

This was the first time I'd used the [`strings.Builder`](https://www.calhoun.io/concatenating-and-building-strings-in-go/) that came out in go 1.10, and it's a very nice API.

```golang
// Prose converts a path into readable text
func (p Path) Prose() string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "%s and %s are separated by %d degrees. ", p[0].Name, p[len(p)-1].Name, p.Degrees())
	fmt.Fprintf(&sb, "%s was in \"%s\" with %s", p[0].Name, p[1].Name, p[2].Name)
	for i := 3; i < len(p); i += 2 {
		fmt.Fprintf(&sb, ", who was in \"%s\" with %s", p[i].Name, p[i+1].Name)
	}
	return sb.String()
}
```

#### Fixing Broken Names

Since the spelling of actor's names is hard to get right, I implemented a basic auto-correct function as well.

There are [much better algorithms](https://medium.com/@wolfgarbe/1000x-faster-spelling-correction-algorithm-2012-8701fcd87a5f) but [FindPerson](https://github.com/jbarratt/lambdadb/blob/master/bacon/graph.go#L86) works well enough for now.

It was actually pretty amusing to see a precise description of my approach as the "Naive approach" in that "better algorithms" link!

> **Naive approach**
>
> The obvious way of doing this is to compute the edit distance from the query term to each dictionary > term, before selecting the string(s) of minimum edit distance as spelling suggestion. This exhaustive search is inordinately expensive.

I think for this application a spell check which was "popularity-biased" would be useful.

```
$ ./baconcli path "Martin Shorts" "Michael Myers"
Name not found, using most similar
Fuzzy Finding took 236.114282ms
Name not found, using most similar
Fuzzy Finding took 232.003397ms

Start Node: {Martin Short true 519 21298}
End Node: {Michaela Myers true 971867 168181}

2018/07/11 08:24:05 Search took 9.689411ms

Michaela Myers and Martin Short are separated by 4 degrees. Michaela Myers was in "Bridegroom" with Sasha Andreev , who was in "Best Man Down" with Evan Jones, who was in "Guardians of the Galaxy Vol. 2" with Zoe Saldana, who was in "Get Over It" with Martin Short
```

In this case, "Michael Myers" should probably become "Mike Myers", not "[Michaela Myers](https://www.imdb.com/name/nm3638900/)", even though her name is has a lower [edit distance](https://en.wikipedia.org/wiki/Edit_distance).

In the next post, I'll get into how I gathered the data, and got it into an embeddable compact adjacency list form.

Check out the [full source](https://github.com/jbarratt/lambdadb/blob/master/bacon/graph.go) to explore further.
