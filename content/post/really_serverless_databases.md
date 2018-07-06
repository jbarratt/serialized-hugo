---
title: "Really Serverless Databases"
date: 2018-07-05T17:34:10-07:00
lastmod: 2018-07-05T17:34:10-07:00
description: "Making serverless databases even more serverless"
draft: false
slug: "serverless_db"
---

At Re:Invent 2017, AWS announced [Aurora Serverless](https://aws.amazon.com/rds/aurora/serverless/).
This is a very exciting evolution of database technology -- all the value of a scalable, relational store -- but it scales to zero while you're not using it. This brings "real" databases within reach for intermittently used applications where the costs of running them full time wouldn't be justified, and especially will be excellent for test environments.

The announcement got me thinking about something else, though. I wondered if there were certain types of databases which would work well if *directly embedded in lambda functions*. And, after thinking about it some more, I think there are.

### Really Serverless Databases

So, by 'really serverless', I mean "lambda-embedded databases." Or "function-as-a-service-embedded databases", to make it generic.

![serverless databases](/images/serverless_db/serverless_db.svg)

Why would you want this?

1. Lambda functions are extremely scalable. You can run 1,000 of them concurrently without even nicely asking AWS to raise the limit. Databases are well known to be extremely unscalable, at least without lots of care, feeding, and spending.
2. Embedded databases should have great performance, as there would be no network hop or serialization/deserialization overhead to get to the data. That's the case even if it would be a single request/response cycle, let alone if you have to do multiple queries.
3. Fewer moving pieces means fewer things that can go wrong; if your application can use just "a lambda", that's probably better than "a lambda and a database."

I couldn't find much prior art for people doing this from within lambda functions, but there are great success stories about [using embedded datastores](https://hackernoon.com/what-i-learnt-from-building-3-high-traffic-web-applications-on-an-embedded-key-value-store-68d47249774f). A serverless embedded datastore just takes that power to the next level!

### Constraints

So, what are the constraints to consider?

* The data must be **relatively infrequently** updated. You *probably* could upload a new function every minute, but you *probably* don't want to. (Interestingly, though, I don't see that updating functions is a billable event, so maybe you do want to!)
* **Read-only** data would be ideal; though you could handle user updated information by pushing it to another service, it'd break "read after write" consistency in most cases.
* The entire payload (including code and whatever data is being stored) should be **under 250MB unzipped**, and ideally 50MB zipped. (Though apparently if you upload the zip to S3 yourself, the 50MB limit is waived.)
* The **lower the memory profile**, the better, as lambda is billed on the basis of "memory used per 100 milliseconds".
* Queries should be **difficult to cache**. If they are easy to cache, it may be better to just keep them even further towards "the edge", like in Cloudfront.

### Possible Use Cases

I'll admit, those do seem like tough constraints. It seems there are quite a few use cases which do actually fit nicely between them, though.


#### Geospatial Databases

Geographic data is actually an ideal fit. Consider the common use case of a "store locator".

* Queries will be coming for any number of coordinates, making it difficult to cache
* An awful lot of latitude/longitude/metadata can be stored in 250MB. For example, there are ~30,000 Starbucks locations worldwide. If you store the coordinates in 6 bytes, that maps to about 2.4 meters of accuracy. So, about 180 kB to store all of the actual locations, leaving plenty of room for additional metadata about the store. There are many businesses who have fewer significant locations to keep track of.
* The data is likely to be updated infrequently; the physical world tends to move more slowly than the digital one.

I haven't played around with it yet, but [Buntdb](https://github.com/tidwall/buntdb) looks like it may be a very nice embeddable database for general use, but especially for geospatial; it includes built-in support for finding the "N closest points" or "all points within a certain distance".

#### Security Screening

There are lots of relatively small and static datasets that can be useful for determining if a request should be handled, or how careful we should be in handling it.

There are a number of free and paid reputation lists such as [spamhaus](https://www.spamhaus.org/drop/drop.txt) (23k), [torproject](https://check.torproject.org/exit-addresses) (153k), and [emergingthreats](https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt) (12k). With removing comments, deduplication, and CIDR grouping, this combined dataset could be shrunk even further.

There are also other databases keyed off IP Address that might be helpful, like the free [GeoLite2](https://dev.maxmind.com/geoip/geoip2/geolite2/). There's a database for mapping IPs to countries, handy for those who need to comply with certain regulations. It comes already helpfully packed in a 1.75MB binary database, perfect for embedding.

NIST also publishes a list of [common bad passwords](https://cry.github.io/nbp/), which contains the most common 1,000,000 passwords. In raw form, that's still only 8MB. (Take a peek at the [top 100](https://github.com/cry/nbp/blob/master/build_collection/top100) if you want to feel really good about your own password choices. I was curious why 'dragon' was in the top 10, and it turns out [Wired just wrote about it](https://www.wired.com/story/why-so-many-people-make-their-password-dragon/) a few months ago!)

Information like this, though, can be massively compressed, especially if probabilistic structures such as [Bloom or Cuckoo Filters](http://blog.fastforwardlabs.com/2016/11/23/probabilistic-data-structure-showdown-cuckoo.html) are used.

#### Spell Checking / Typo Correction

There are many domains where the valid terms to search a database against are constrained. Consider a database that worked with chemicals; it would be useful to be able to autocorrect "pulonium" to "polonium" before sending the query to a backend.

This could be true for many things, such as where there's a well-known list of keys to values, such as geographic information, or creative works like books, movies, music, and so on. Instead of getting the (typo'd) query from the user, searching for it, and returning an error, with a local autocorrect database, there are many other options.

* prescreening the query before sending to the backend, only letting valid queries through
* catching queries that come back with no results, and retrying with the most probable alternative (like google does)
* returning the error, but giving the user some "did you mean" suggestions

Spell checking and approximate matching algorithms tend to require lots of high volume queries, so are especially well suited to having the data local to you (and in memory, ideally.)

#### Caching The Hot Head

In many (and probably most) environments, queries follow a power law distribution. It's not uncommon to have the top 1% of queries represent 90% -- or much more -- of the total query volume.

If the data is relatively stable, caching those requests directly in the lambda could provide significant performance improvements *and* cost savings -- especially since lambdas are billed by their total running time, you pay on both ends to make queries.

If one of the "hot head" items were updated, that could be the trigger for deploying a new lambda with the latest values in it. This would be an easy way to over-optimize, so do the math before trying!


#### Graph Databases

I've been watching graph databases for many years. They've had a fairly slow burn of growth over time, but there's even a managed one on Amazon now ([AWS Neptune](https://aws.amazon.com/neptune/)).

There's an open source graph database called [Cayley](https://cayley.io/) which is built to be embeddable and could be integrated into a Lambda.

These databases can be used for all kinds of data which would be a challenging fit for a relational model, such as social networks. I have seen the SQL query for friends of friends of friends and it is a thing which cannot be unseen.

Also, if a full-blown generic graph database is not warranted, it's fairly straightforward to build out an optimized graph that can be queried within a process. Which is actually what I did to test out this idea!

### Testing this idea

I've always been fascinated by the [Oracle of Bacon](https://oracleofbacon.org/). For those who haven't seen it, the idea is to think of 2 actors, and then figure out a "path" you can take through the films they have been in to connect them. The number of movies you have to name is their "Bacon Number" or "degrees of separation."

> *Don Cheadle and Charlize Theron are separated by 2 degrees. Don Cheadle was in "Avengers: Infinity War" with Josh Brolin, who was in "In the Valley of Elah" with Charlize Theron.*

This is a perfect application of graph databases. The actors and the films are both nodes, and having appeared in them creates a link between those nodes.

![movie data as graph](/images/serverless_db/movie_graph.svg)

A teaser for the experiment (which actually generated the above text):

* The graph has **920,000** films and **215,000** people
* It compresses to about **9 MB** of data (including the movie titles, people's names, and relationships between them)
* Querying the database takes only ~**1.5ms**, with likely some more optimizations possible
* Running a lambda function to query this data and return the results completes incredibly quickly: ~**40ms**, which makes it suitable for even latency-sensitive applications, including for use as Alexa Skills.

In the next posts I'll explore:

* How to build an extremely fast lambda-embedded graph search with Go
* How to turn that into an Alexa Skill
* Some fun and strange insights from the graph data itself.

If you want to look at the code for the experiment, it's at [jbarratt/lambdadb](https://github.com/jbarratt/lambdadb).

### IN CONCLUSION

While they won't replace all of your database needs, embedding databases with lambdas has a huge amount of potential. Especially if you're using a lower level language like Go, there are many off the shelf libraries that can help. A sampling that seem to be highly recommended:

* [Bleve](https://github.com/blevesearch/bleve) for text indexing
* [Badger](https://github.com/dgraph-io/badger) appears to be the leading embeddable key value store
* [QL](https://github.com/cznic/ql) and, of course, [sqlite3](https://github.com/mattn/go-sqlite3) are embeddable SQL stores
* [Buntdb](https://github.com/tidwall/buntdb) is a more sophisticated k/v store which includes spatial search
* [Cayley](https://cayley.io/) for graph data

I haven't tested any of those specifically in lambda, but apparently I have a new hobby so it may happen soon. (And let me know if you try any of these ideas out!).
