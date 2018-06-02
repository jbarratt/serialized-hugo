+++
title = "Finding Feeds 3 Ways"
date = "2018-06-01T14:44:46-07:00"
description = "Using Pinboard bookmarks to populate a Feed Reader, Overengineering Edition"
+++

I took a break from using an feed reader for a few years. I was a big fan of the original Google Reader, and when it died, semi-moved to [Feedly](https://feedly.com/i/welcome), but it never quite stuck. I stopped using it all together as part of a general information diet a few years ago. Feed readers are great, though. There's been a definite hole in my knowledge and awareness of how things are moving in technology, and it was time to get back into the (moderate) habit.

So, after firing up a fresh Feedly account, there was a problem. What to subscribe to? An idea was born. When I find a page useful, I save it in [Pinboard](pinboard.in), and it's easy to get a nice JSON file of all of the pins. Also, given a post, it's often straightforward to find it's RSS or Atom feed, if it has one -- there's a `<link rel="alternate">` tag for that. The idea, then:


* Download every page that's bookmarked
* Grab any alternate links from the page body and keep track of them
* Print out frequently occurring links as possible things to subscribe to

### TL;DR

In one sense it worked, but not super well, only yielding 4 sites to subscribe to. It probably would have been better to just skim my list of pins directly.

In another sense -- the more important sense -- it worked great, because it was fun and a good chance to play with a few technologies and see how different approaches map onto the same toy problem.

### Approach One: Modern-ish Python

I'd wanted a chance to play with [Requests-HTML](https://html.python-requests.org/) for a while, and this seemed like a good opportunity.
It seems to provide a really nice simple API for when you want to fetch and parse HTML. Being able to pick the links needed with selectors is very slick.

However, this approach isn't fast. It's totally synchronous. So the running time is the time to serially download and parse every single page, one by one. Even limiting to just 400 sites it took about 10 minutes, which is why I added `tqdm`, a very cool looking [progress bar](https://github.com/tqdm/tqdm).

```python
import json
from requests_html import HTMLSession
from collections import Counter
from tqdm import tqdm

def main():
    session = HTMLSession()
    sel = 'link[rel=alternate]'
    feeds = Counter()
    bookmarks = json.loads(open('pinboard_export.json', 'r').read())
    links = [x['href'] for x in bookmarks]
    for link in tqdm(links[0:400]):
        # There are lots of things that can go wrong in here.
        # timeouts, unicode decode errors, etc. Just keep the ones that work.
        try:
            r = session.get(link)
            for feed in r.html.find(sel):
                if 'href' in feed.attrs:
                    # put the right domain/path prefix on if needed
                    feeds[feed._make_absolute(feed.attrs['href'])] += 1
        except:
            pass
    for feed, count in feeds.most_common(200):
        print(f"{feed}: {count}")

if __name__ == '__main__':
    main()
```

I considered refactoring this code with `threads` or `multiprocessing`, which would likely have worked very well, but I've been there and done that. So since this is a toy problem, time to go to the bleeding edge!

### Approach Two: Modern-er (Async) Python

Warning, there are very likely errors in this code due to my newness with `asyncio`. That's another thing I'd wanted to get the chance to tinker with.
I've done a decent bit of work with async programming in general, but this API admittedly makes my head hurt a bit.

One example thing that would need to be improved for a real app -- this downloads all the sites, keeps all the payloads in memory, and *then* parses them.
It would be a lot more efficient to parse the sites, extract the feeds, and free up that memory on the fly.

Though it's more code, though, it runs insanely fast. About **34 seconds** to process **1500 links**!

I did run into an [ugly bug in aiohttp](https://github.com/aio-libs/aiohttp/issues/1116) which meant a lot of the pages barfed what seem to be untrappable errors to STDERR, so this edition of the program saves the results to a file on disk instead to help reading between the lines.

Since some github-hosted pages generate this error, at this point I started filtering out pages on github.com (which I know won't have feeds I want anyway) and youtube.com while I was at it.

```python
#!/usr/bin/env python3

import aiohttp
import asyncio
import json
from requests_html import HTML
from collections import Counter

async def fetch(session, url):
    print("getting url " + url)
    async with session.get(url) as response:
        return await response.text()

async def fetch_all(session, urls, loop):
    results = await asyncio.gather(
        *[fetch(session, url) for url in urls],
        return_exceptions=True
    )
    print(f"Fetched {len(urls)} pages, parsing")
    for result in results:
        if isinstance(result, Exception):
            continue
        # there's a lotta malformed stuff out there, let it all ride
        try:
            parsed = HTML(html=result)
            for feed in parsed.find('link[rel=alternate]'):
                if 'href' in feed.attrs:
                    feeds[feed._make_absolute(feed.attrs['href'])] += 1
        except:
            pass

async def main(loop):
    bookmarks = json.loads(open('pinboard_export.json', 'r').read())
    urls = [x['href'] for x in bookmarks
            if '/github.com/' not in x['href'] and 'youtube.com/' not in x['href']]
    timeout = aiohttp.ClientTimeout(total=30)
    async with aiohttp.ClientSession(loop=loop, timeout=timeout) as session:
        await fetch_all(session, urls, loop)

feeds = Counter()
loop = asyncio.get_event_loop()
loop.run_until_complete(main(loop))
with open('popular_feeds.txt', 'w') as of:
    for feed, count in feeds.most_common(1000):
        if feed.startswith("http"):
            of.write(f"{feed}: {count}\n")

```

### Approach 3: Go (with Colly)

Since async Python was making my head hurt a little, it was compelling to try things with Go instead, where my concurrency experiences have been a lot more pleasant and reliable.

I had bookmarked (in Pinboard, natch) a Go scripting framework called [Colly](http://go-colly.org/). I found that it was, indeed, "fast and elegant" to work with.

The entire codebase is a lot more verbose, but interestingly it's the "hard parts" which are the most straightforward.

There are 10 lines of code (the `main` method) which implement what takes about 30 lines of python in the example above; but it takes nearly 50 lines of code to replace the functionality of the `collections.Counter` that's shipped with Python! There may be a libray-based equivalent to drop in, but a quick google didn't help much.

The go solution is also (slightly) faster than the async python code, with a runtime of **31 seconds**. This is a pretty impressive result.

```golang
package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"sort"
	"strings"
	"sync"

	"github.com/gocolly/colly"
	"github.com/gocolly/colly/queue"
)

func main() {

	c := colly.NewCollector()
	count := NewCounter()
	q, _ := queue.New(
		100, // consumer threads
		&queue.InMemoryQueueStorage{MaxSize: 100000}, // default queue storage
	)
	loadQueue(q)

	c.OnHTML("link[rel=alternate]", func(e *colly.HTMLElement) {
		count.Add(e.Request.AbsoluteURL(e.Attr("href")))
	})

	q.Run(c)
	count.Save("popular_feeds_golang.txt")
}

// Add all bookmarks to queue
func loadQueue(q *queue.Queue) {
	var pins []pin
	raw, err := ioutil.ReadFile("./pinboard_export.json")
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	}
	json.Unmarshal(raw, &pins)
	for _, pin := range pins {
		if !(strings.Contains("/github.com/", pin.Href) || strings.Contains("youtube.com/", pin.Href)) {
			q.AddURL(pin.Href)
		}
	}
}

type pin struct {
	Href        string `json:"href"`
	Description string `json:"description"`
	Tags        string `json:"tags"`
}

type counter struct {
	counts map[string]int
	sync.RWMutex
}

func NewCounter() *counter {
	var c counter
	c.counts = make(map[string]int)
	return &c
}

func (c *counter) Add(feed string) {
	c.Lock()
	defer c.Unlock()
	c.counts[feed] = c.counts[feed] + 1
}

func (c *counter) Save(filename string) error {
	c.RLock()
	defer c.RUnlock()

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	type kv struct {
		Key   string
		Value int
	}
	var ss []kv
	for k, v := range c.counts {
		ss = append(ss, kv{k, v})
	}
	sort.Slice(ss, func(i, j int) bool {
		return ss[i].Value > ss[j].Value
	})
	for _, kv := range ss {
		fmt.Fprintf(file, "%s: %d\n", kv.Key, kv.Value)
	}
	return nil
}

```

### Conclusion

I think I'll still reach for Python for quick and dirty scripts, especially ones where runtime isn't a big issue. But based on this little experimentation, I'd be pretty nervous about basing a serious project around `asyncio` just yet. If I had to take one of these prototypes and turn it into something production-ready, there's no question that it'd be the Go version. And Colly is very impressive, bravo to them! The interface is so elegant and straightforward, and has all the knobs I'd want.
