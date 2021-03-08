---
title: "Should you build serious multiplayer game backends with serverless and DynamoDB?"
slug: "intense_dynamodb"
date: 2021-02-09T20:23:21-08:00
lastmod: 2021-02-09T20:23:21-08:00
description: "A previous post looked at using Lambda, API Gateway+Websockets and DynamoDB for multiplayer gaming. However, it used an almost trivial example. Can the same stack be used for more games or other apps with more demanding state? How much state is too much?"
summary: "A previous post looked at using Lambda, API Gateway+Websockets and DynamoDB for multiplayer gaming. However, it used an almost trivial example. Can the same stack be used for more games or other apps with more demanding state? How much state is too much?"
draft: false
---

A previous post on this blog looked at [Building a Multiplayer Game with API Gateway+Websockets, Go and DynamoDB]({{<ref "multiplayer">}}). 

The point of that post was to provide an **end to end example** of a how an app like that could work on the serverless stack, from a full working Vanilla Javascript frontend, Infrastructure as Code deployment, a Go on Lambda backend, and with state stored in DynamoDB. I intentionally chose a pretty simple application (that still actually worked -- and [still works right now](https://serialized.net/app/rpsls/) -- so it was reasonably easy to understand each layer.

I was very, very, very much not trying to say that ALL multiplayer games, or realtime applications, should use this stack!

## Even so, a question arrives

A few weeks ago, I got a nice email from someone who I will heavily paraphrase here:

> Thanks for writing the post. It's being passed around the game company I work at to make the case that we don't need server-based game backends. However, I see your example is really simple. Our game needs to work for hundreds of players, with a very complex game state that's frequently updated. Can the serverless architecture work for those cases too?

This is a great followup. Can you use a DynamoDB and Serverless backend for a serious, high-state, modern game, or is it only useful for incredibly simple rock-paper-scissors level games?

{{< img src="cover-gamer.jpg"  alt="serious gamer is serious"   class="center"  >}}

Before I get into that, it's worth noting that there are **many** useful applications which work at a similar level of i/o to the example in the last post. It would work equally well for basically any of the web-based apps I use for work on a daily basis. It would also work great for a lot of multiplayer games: 

* Anything where you are storing leaderboards or achievements, or doing matchmaking
* Turn-based games
* Board or card games
* Near real-time business apps
* Chat or collaboration features
* Software update systems
* ... or anything else which is not _that_ state intensive

As an example of a not-toy product that fits this criteria, we're heavy users of [sli.do](https://sli.do) at work. The core features of it would happily run on an architecture just like Rock/Paper/Scissors/Lizard/Spock. (Interestingly enough, it looks like they do have Dynamo as part of [their stack](https://www.sli.do/security), but they also have RDS.)

But that's not the question: how hardcore does your game state need to be before Dynamo and Serverless are not good options?

## What do most game servers look like today?

Ok, so let's start by looking at what game servers tend to look like.

In 2018, Google launched a hosted service with a matching open source project for managing game servers. [Their launch blog post](https://cloud.google.com/blog/products/containers-kubernetes/introducing-agones-open-source-multiplayer-dedicated-game-server-hosting-built-on-kubernetes) summarizes the state of the art, as much as I can tell from outside the game industry, pretty well. Emphasis added:

> Many of the popular fast-paced online multiplayer games such as competitive FPSs, MMOs and MOBAs require a dedicated game server — a **full simulation of the game world** — for players to connect to as they play within it. This dedicated game server is usually hosted somewhere on the internet to **facilitate synchronizing the state of the game between players**, but also to be the arbiter of truth for each client playing the game, which also has the benefit of **safeguarding against players cheating**.
Dedicated game servers are stateful applications that retain the **full game simulation in memory**. But unlike other stateful applications, such as databases, they have a **short lifetime** (minutes or hours).
Dedicated game servers also need a **direct connection to a running game server process's hosting IP and port**, rather than relying on load balancers. These fast-paced games are extremely **sensitive to latency**, which a load balancer only adds more of. Also, because all the players connected to a single game server share the in-memory game simulation state at the same time, it’s just easier to connect them to the same machine.

This makes sense. These games are managing a ton of complex and rapidly changing state -- and trying to read in updates from players, simulate the game, send it back out to players, and detect cheaters as fast as possible. Tiny differences in latency can make the game feel laggy. Lambda can perform well, but occasionally (especially with a cold start) it can easily take 10s or 100s of milliseconds. That's probably not acceptable for something like a first person shooter.

There's another factor, too. When you build a multiplayer game, there is a lot of overlap between building the game client, and building the game server -- especially if you're using a framework like Unreal or Unity, and extra-especially if you want to offer the ability for people to do local multiplayer, where one person is both playing the game and acting as the server.

TODO put a diagram here

Finally, it's important to think about what the uptime implications are. Nobody loves a game crash, but they are just accepted in this world. I have a friend who works in esports and he says they are so common they have a euphemistic name for them. "We're experiencing a game pause." And this makes sense -- for a short running game, in a short running process, you're probably far more likely to experience a software issue (which could hit on any stack) than you are to have a problem with the underlying physical or virtual infrastructure.

So, if it's true that

1. You get most of the game server 'for free' as part of writing your game
2. You are willing to accept crashes and the loss of all of that state
3. The amount of state you're storing would be way too expensive to store durably at all, within your economic model
3. Single millisecond latencies matter a great deal to the experience of your game, and lag is unacceptable

... then yeah, using an instance for your game backend seems very reasonable.

## What If That's Not All True Though



* Some of it (e.g. player achievements, scores, in-game purchases, etc) probably needs to be stored very durably. Losing those sorts of things will make players very unhappy.
* Some other things (e.g. player position, which is being updated many times a second) may only need to be stored ephemerally. If a player stops updating it, they're disconnected anyway, and if they're actively updating, new data will be available soon if needed.
* Other data probably falls in between those extremes. If it's available most of the time, it's ok.

The trick with the serverless stack from the previous example is that you really only have one option for persistence -- do a write to DynamoDB. This is a relatively expensive operation, because Dynamo provides very high quality guarantees for the durability of that write! 


## A contrived example

Let's bake a simple model to think this through:

* 300 players, playing constantly
* All updating position data 60 times a second
* 300 x 60 = 18,000 updates/second, 1.080 million updates/minute

This would be pretty expensive to write straight to Dynamo. In fact, this would be pretty expensive to write to _any_ durable storage. 

Dynamo can run in two modes, "On-Demand" -- where you pay per access -- and "Provisioned" -- where you pay for a given rate of access.

Using DynamoDB's list prices for on-demand writes:

* $1.25/million write request units
* $0.25/million read request units

1.080 million updates/minute * $1.25/million writes * 60 minutes in an hour * 24 hours in a day * 30 days in a month = **$58,320 a month** in demand mode write costs.

Amazingly, though, by using provisioned capacity (18,000 WCU) you can get that down to **$8,541** a month. 

And if you're willing to do a 1-year prepay, you can get it down to **$1,681** a month!

Comparing this with the server realm:

If you give up a lot of the nice things you get with Dynamo (scailability and availability, let alone the army of other features) you can certainly save _some_ money. An io2 volume which is provisioned for 18,000 iops is will run you about **$1,100** a month. But that's just the volume -- you'll need to attach compute to it as well. If you add a `c5.4xlarge` that will add $581/mo, for **$1,681**. <small>This is, by what I can only imagine is an incredibly strange coincidence, the same exact price as the 1 year prepay amount for Dynamo. Weird.</small>

It's pretty impressive, in context. Adding a 1 year prepay to the EC2+EBS solution gets the price down lower there as well, but the difference is small enough that if you even ran a pair of EC2/EBS instances for redundancy, you're spending more than on Dynamo -- which runs out of the box in multiple Availability Zones, can scale down when you're not using it, handles your data growth, does snapshot backups, can stream changes, and on and on. 

TODO: write amplification factor here too. Pros, can cache/buffer; cons, may actually still end up with more disk iops than WCU's

**Conclusion**: DynamoDB is price competitive with a home rolled solution, especially if you have any need for availability and scalability.

## Ok, what about non-durable writes?





<span>Cover Photo by <a href="https://unsplash.com/@florianolv?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Florian Olivo</a> on <a href="https://unsplash.com/s/photos/gamers?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Unsplash</a></span>

Resources for this post:
 
* [Indie MMORPG Server Architecture Design](https://brandonlamb.com/indie-mmorpg-server-architecture-design/)
* [Scalable Game Development Patterns on AWS](https://d1.awsstatic.com/whitepapers/aws-scalable-gaming-patterns.pdf)
* [Photon Hosted Backends](https://www.photonengine.com/en-US/Server)
* [Firebase for Unity](https://firebase.google.com/docs/unity/setup)
* [Agones](https://github.com/googleforgames/agones) -- game server management for kubernetes -- and the [Google Game Servers](https://cloud.google.com/game-servers) hosted version.
