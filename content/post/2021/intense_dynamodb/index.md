---
title: "What are the limits of serverless for online gaming?"
slug: "serverless_gaming_limits"
date: 2021-03-10T16:23:21-08:00
lastmod: 2021-03-10T16:23:21-08:00
description: "A previous post looked at using Lambda, API Gateway+Websockets and DynamoDB for multiplayer gaming. However, it used an almost trivial example. Can the same stack be used for more games or other apps with more demanding state? How much state is too much?"
summary: "A previous post looked at using Lambda, API Gateway+Websockets and DynamoDB for multiplayer gaming. However, it used an almost trivial example. Can the same stack be used for more games or other apps with more demanding state? How much state is too much?"
draft: false
---

A previous post on this blog looked at [Building a Multiplayer Game with API Gateway+Websockets, Go and DynamoDB]({{<ref "multiplayer">}}). 

The point of that article was to provide an **end to end example** of a how an app like that could work on the serverless stack, from a full working Vanilla Javascript frontend, Infrastructure as Code deployment, a Go on Lambda backend, and with state stored in DynamoDB. I intentionally chose a pretty simple application (that still actually worked -- and [still works right now](https://serialized.net/app/rpsls/) -- so it was reasonably easy to understand each layer.

I was very, very, very much not trying to say that ALL multiplayer games, or realtime applications, should use this stack!

## A question arrives ✉️ 

A few weeks ago, I got a nice email from someone who I will heavily paraphrase here:

> Thanks for writing the post. It's being passed around the game company I work at to make the case that we don't need server-based game backends. However, I see your example is really simple. Our game needs to work for hundreds of players, with a very complex game state that's frequently updated. Can the serverless architecture work for those cases too?

This is a great followup. (Which very effectively [nerdsniped](https://xkcd.com/356/) me.) 

**Can you use a DynamoDB and Serverless backend for a serious, high-state, modern game, or is it only useful for incredibly simple rock-paper-scissors level games? What is the most complex game you _can_ use it for?**

{{< img src="cover-gamer-serverless.jpg"  alt="serious gamer is serious"   class="full-width"  >}}

Before I get into that, it's worth noting that there are **many** useful applications which work at a similar level of complexity to the example in the last post. It would work equally well for basically any of the web-based apps used in most of our work on a daily basis, and a large number of games as well.

* Anything where you are storing leaderboards or achievements, or doing matchmaking
* Turn-based games
* Board or card games
* Near real-time business apps
* Chat or collaboration features
* Software update systems
* ... or anything else which is not _that_ state intensive

After I started working on this post, AWS posted an excellent article by [Tim Bruce](https://twitter.com/timbrucemi/) called [Building a serverless multi-player game that scales](https://aws.amazon.com/blogs/compute/building-a-serverless-multiplayer-game-that-scales/). In it, Tim describes a "Simple Trivia Service" game, which is well worth looking at in depth. The example has single and multiplayer modes, matchmaking, leaderboards, logins, and more. It's far closer to a 'real' backend than the example I featured in my last post.

## What do most "state intensive" game servers look like today?

What does the backend for a modern AAA multiplayer title look like?

In 2018, Google launched a hosted service with a matching open source project for managing game servers. [Their launch blog post](https://cloud.google.com/blog/products/containers-kubernetes/introducing-agones-open-source-multiplayer-dedicated-game-server-hosting-built-on-kubernetes) summarizes the state of the art, as much as I can tell from outside the game industry, pretty well. Emphasis added:

> Many of the popular fast-paced online multiplayer games such as competitive FPSs, MMOs and MOBAs require a dedicated game server — a **full simulation of the game world** — for players to connect to as they play within it. This dedicated game server is usually hosted somewhere on the internet to **facilitate synchronizing the state of the game between players**, but also to be the arbiter of truth for each client playing the game, which also has the benefit of **safeguarding against players cheating**.
Dedicated game servers are stateful applications that retain the **full game simulation in memory**. But unlike other stateful applications, such as databases, they have a **short lifetime** (minutes or hours).
Dedicated game servers also need a **direct connection to a running game server process's hosting IP and port**, rather than relying on load balancers. These fast-paced games are extremely **sensitive to latency**, which a load balancer only adds more of. Also, because all the players connected to a single game server share the in-memory game simulation state at the same time, it’s just easier to connect them to the same machine.

This makes sense. These games are managing a ton of complex and rapidly changing state -- and trying to read in updates from players, simulate the game, send state changes back out to players, and detect cheaters -- all as fast as possible. Tiny differences in latency can make the game feel laggy. Lambda can perform well, but occasionally (especially with a cold start) it can easily take 10s or 100s of milliseconds. That's probably not acceptable for something like a first person shooter.

There's another factor, too. When you build a multiplayer game, there is a lot of overlap between building the game client, and building the game server -- especially if you're using a framework like Unreal or Unity, and extra-especially if you want to offer the ability for people to do local multiplayer, where one person is both playing the game and acting as the server.

{{< img src="local-multiplayer.png"  alt="local multiplayer gaming"   class="center"  >}}

Finally, it's important to think about what the uptime implications are. Nobody loves a game crash, but they are just accepted in this world. They are not on the same scale as "risk of losing a bank transaction." A friend who works in esports reported that crashes are common enough that they have a protocol and a euphemistic name for them. 

"Sorry folks, We're experiencing a game pause." 

And this makes sense -- for a short running game, in a short running process, you're probably far more likely to experience a software issue (which could hit on any stack) than you are to have a problem with the underlying physical or virtual infrastructure.

So, if it's true that

1. You get most of the game server 'for free' as part of writing your game
2. You are willing to accept crashes and the loss of all of that state
3. The amount of state you're storing would be way too expensive to store durably at all, within your economic model
3. Single millisecond latencies matter a great deal to the experience of your game, and lag is unacceptable

... then yeah, I'd probably use an instance-based game engine, at least for the core.

## It's probably still worth thinking about hybrid architectures 🤔

Modern games have a lot more going on than just the high state intensity stuff. There's also:

* Chat outside of the game engine
* Lobby/Matchmaking features
* Authentication/Authorization
* Software/Patch/Asset distribution
* Analytics
* In-App Purchases
* Achievements/Game Items
* Player Profiles

... and more. Some of those capabilities you may get from other platforms, but the less insane request rate makes the serverless environment more feasible if it's something you'd need to build. 

So, a hybrid architecture might make sense -- use serverless for those sorts of things, and drop into a 'real' server for the high state game play.

For game aspects like achievements and purchases, something with strong durability (like DynamoDB) is essential. Losing things you have earned or paid for is one of the worst customer experiences in gaming. (I will not soon forget having to explain to one of my kids that no, it's not ok to throw a controller, 🎮 even if you did just get kicked out of a game right after you finally came in first, and no, you probably won't get the XP for it.)


## So ... Where is the line? ✏️

If you've come with me so far, there are games where serverless is the obvious choice. In the example from the previous post, you can handle thousands of game rounds for less than the cheapest instance AWS offers, AND your game will be more scalable, secure, reliable, and more. So that's the serverless zone.

{{< img src="limits-of-serverless.png"  alt="The limits of Serverless"   class="center"  >}}

At the other end of the spectrum, there are the games that we've looked at likely never making sense with (at least this generation) of Serverless. The "Instances, yup, that checks out" zone.

So this got me curious -- what is the boundary between those two zones? How might we find it?

I focused on two key questions:

1. What kind of latency can I get from the serverless stack, and how predictable is it?
2. At what level of state management does serverless become unaffordable?

My goal here is not to be comprehensive. There are too many variables between different protocols, instance types, networking configuration, CPU allocation, let alone the actual work that any real game might be trying to do, to worry too much about the details. For both the cost and latency numbers, this reasearch is basically one step beyond 'back of the napkin' math.

### The Latency Question ⏲️

#### Test Setup

This test looks at latency, which is key for realtime interactivity. It's important for getting your updates to the server in a timely manner and for having the game world represent the world you're in as well. For this test, I looked at **round trip time**, how long it takes for me to send an event, have the backend process it, and get me the reply, because it roughly models the time it might take for some action I take in the game world to get to the other players.

To test this, I used websockets as a standard method, to reduce one of the variables across the different platforms.

{{< img src="test-method.png"  alt="Latency test method" class="half" >}}

I wrote a simple client that sends the current time (in nanoseconds) to a websocket echo server. When it gets the results back, it compares that to the current time, calculates the difference, and stores it. It does this in a single threaded way -- waiting until it gets a response before it sends the next. The goal for this test was not to test concurrency, but to test backend to server request/response time.

This test then was run a few thousand times against 4 different versions of websocket echo:

{{< img src="test-harness.png"  alt="testing against local, EC2, and serverless"   class="center"  >}}

1. **Local**: A client/server both running on the same host
2. **EC2**: The same server running on an EC2 instance, tested from my standard home internet connection
3. **Serverless, Stateless**: API Gateway and Lambda only, without storing the data
4. **Serverless, with DynamoDB**: API Gateway and Lambda, with a read from and write to DynamoDB as part of each message.

#### Results

First, let's look at the numerical results here. If you aren't familiar with the 'p' notation, it's percentile. You can think of p50 as "50% of requests were handled this fast or faster." It's critical to look at percentiles, rather than averages, for things like this where the data is not evenly distributed.

Backend | p50 | p75 | p95 | p99 | Message Rate
--- | --- | --- | --- | --- | ---
Local Client/Server | 0.32ms | 0.35ms | 0.39ms | 0.43ms | 3076 messages/sec
EC2 Instance | 46ms | 48ms | 51ms | 54ms | 21.3 messages/sec
Serverless (No Dynamo) | 64ms | 69ms | 103ms | 1035ms | 10.9 messages/sec
Serverless (Dynamo r/w) | 77ms | 97ms | 269ms | 1175ms | 7.8 messages/sec

The **local** numbers are interesting, because they provide the baseline of how long it takes to do all the inherent plumbing -- generating the message, sending it on the network, processing it on the other end, and getting it back. 

{{< img src="local-kde.svg"  alt="local kernel density" class="half" >}}

Zooming into the data from the local test, it's very predictable, and it's very fast. All the results are sub-millisecond, and they're very tightly grouped.

Things get a lot more interesting when there's a network hop involved.

{{< img src="latency-boxplot.svg"  alt="local multiplayer gaming"   class="full-width"  >}}

This is a log-scale boxplot which makes it clearer what's happening. The ec2 row is centered around 46ms, with not much variability across requests. The two serverless rows have many outlier points in between 10^2 (100ms) and 10^3 (1 second), with clusters on the high side of 1 second, which I suspect are "cold starts", when a new lambda is spun up to handle increases in traffic.

{{< img src="sls-kde.svg"  alt="local kernel density" class="center" >}}

This chart just compares the two serverless methods, as their response time curves are similar enough to compare side by side. Making the two calls to dynamo has a suprisingly small impact to the p50 time, which is very close to the no-dynamo use case -- but it raises the odds that things will be slower, and it raises the worst case execution time even further.

#### Takeaways

So, in a broad sense, these results are a big +1 for the serverless stack. To be able to get typical round trip times of around 100ms for working with a stateful backend with this little effort and operational overhead? Yes please.

However, if we're talking about latency-sensitive gaming backends, it's not as good. You really really wouldn't want occasional 1 second freezes in the middle of an intense battle.

The long request times **are** avoidable, in part, by using [Provisioned Concurrency](https://aws.amazon.com/blogs/aws/new-provisioned-concurrency-for-lambda-functions/), which specifically is built to prevent this. It keeps lambdas ready to go to handle your requests at whatever concurrency you desire -- an interesting hybrid serverless and servery.

But even with those cold starts out of the picture, it's hard to beat the instance here, especially when there is state to keep track of. The instance response time is dominated by networking limitations that are mostly about the speed of light. 

Because in serverless, there are a few abstraction layers to get through -- and the state needs to be stored persistently -- it's at a fundamental disadvantage here, which shows in the numbers. The 'common' (p50) response times for the dynamo interacting service are almost double the EC2 instance, and that is with extremely minimal state (one value read and written.)

So this is a good heuristic to walk away with. "If you need reliable, < 80ms response times for your application, serverless is probably not for you."

### The Cost Question 💵

In the [original multiplayer game post]({{<ref "multiplayer">}}), I showed that it was possible to run thousands of games, on an infrastructure that scales to zero costs when games were not running, and extremely high availability, for less cost than you could run even the cheapest AWS instance.

This post has hopefully already established that this wouldn't be true if you were trying to use serverless to host the backend for Fortnite. 

We've already looked at this question from the latency angle -- what about costs? At what level does a multiplayer game become more expensive to host on servers versus serverless?

Here is a different way of looking at the architecture I used for the test here, and the points at which it can accrue AWS costs.

{{< img src="state_model.png"  alt="state transfer drives costs" class="center" >}}

I'll put in some cost numbers here -- which represent the list prices, without any discounting or considering the free tier, in us-west-2, as of March 2021. There are some other costs that a real solution would have, like transfer costs, data storage costs, etc. I'm keeping them aside because they'd be fairly consistent regardless of the infrastructure used.

API Gateway charges for 2 things when you're using websockets:

1. A charge per connected client, based on the cumulative length of those connections ($0.25/million connection-minutes)
2. A message send cost ($1/million 32kb chunks of message)


Lambda charges for: 

1. Each request handled ($0.20/Million requests)
2. Per gig-second of memory used by executing processes ($0.0000166667)


DynamoDB charges can vary a lot by the feature you're using, and by if you're using on-demand or provisioned. (Which can be autoscaled, for an extra fun dimension.)

* On Demand
    1. $1.25/million write request units (1kb)
    2. $0.25/million read request units (1kb)
* Provisioned
    1. $0.00065 per Write Capacity Unit
    2. $0.00013 per Read Capacity Unit


That's all hard to visualize, so I put together a basic calculator tuned for this use case. 

There are also some buttons that set up example values for different scenarios. The default is based on the Rock/Paper/Scissors/Lizard/Spock example, and the 'More Serious Game' is based on more players, more state, and a higher request rate.

{{< rawhtml >}}
<form id="calculator">
<ul>
<li><label>How long will an average game take (in minutes)?</label><input type="number" name="duration" value="10" /></li>
<li><label>How many average messages a minute per player?</label><input type="number" name="messagerate" value="5" /></li>
<li><label>How many simultaneous players?</label><input type="number" name="players" value="2" /></li>
<li><label>How much game state needs to be <b>read</b> from DynamoDB per play? (kilobytes)</label><input type="number" name="stateKbIn" value="1" /></li>
<li><label>How much game state needs to be <b>written</b> to DynamoDB per play? (kilobytes)</label><input type="number" name="stateKbOut" value="1" /></li>
<li><label>What size are player messages <b>to</b> the server? (kilobytes)</label><input type="number" name="messageKbIn" value="1" /></li>
<li><label>What size are player updates <b>from</b> the server? (kilobytes)</label><input type="number" name="messageKbOut" value="1" /></li>
<li><label>What will the average lambda runtime be? (milliseconds)</label><input type="number" name="lambdaMs" value="20" /></li>
<li><label>How much memory does the lambda need to run? (megabytes)</label>
<select name="lambdaRambda">
    <option value="128" selected>128</option>
    <option value="512" >512</option>
    <option value="1024" >1024</option>
    <option value="1536" >1536</option>
    <option value="2048" >2048</option>
    <option value="3072" >3072</option>
    <option value="4096" >4096</option>
    <option value="5120" >5120</option>
    <option value="6144" >6144</option>
    <option value="7168" >7168</option>
    <option value="8192" >8192</option>
    <option value="9216" >9216</option>
    <option value="10240" >10240</option>
</select>
</ul>
</form>
<p><b>Presets:</b> <button type="button" id="rpsPreset">Rock Paper Scissors</button><button type="button" id="seriousPreset">More Serious Game</button><button type="button" id="lessDisk">Less Disk State</button></p>

<div id="outputBox" style="border:1px;background:#fff;margin:1em;width: 80%;box-shadow: 5px 5px 19px #ccc;padding: 10px;">
<p>... calculating ...</p>
</div>

<script>

let form = document.querySelector('#calculator');
let elements = Array.from(form.elements);
let values = {}
let outputBox = document.querySelector("#outputBox")

let presets = {
    'rpsPreset': {
        'duration': 10,
        'messagerate': 5,
        'messageKbIn': 1,
        'messageKbOut': 1,
        'stateKbIn': 1,
        'stateKbOut': 1,
        'lambdaMs': 20,
        'players': 2,
    },
    'seriousPreset': {
        'duration': 5,
        'messagerate': 60,
        'messageKbIn': 20,
        'messageKbOut': 50,
        'stateKbIn': 60,
        'stateKbOut': 15,
        'lambdaMs': 100,
        'players': 30,
    },
    'lessDisk': {
        'duration': 5,
        'messagerate': 60,
        'messageKbIn': 20,
        'messageKbOut': 50,
        'stateKbIn': 1,
        'stateKbOut': 1,
        'lambdaMs': 40,
        'players': 30,
    },
}



const calculate = () => {
    elements.forEach(element => {
        values[element.name] = parseFloat(element.value)
    })
    let connMins = values['duration'] * values['players']
    let connMinsPrice = (connMins / 1000000) * 0.25
    let messages = (Math.ceil(values['messageKbIn'] / 32.0) + Math.ceil(values['messageKbOut'] / 32.0))*values['messagerate']*values['duration']*values['players']
    let messagePrice = (messages / 1000000) * 1.0
    let lambdaRequests = values['messagerate'] * values['duration'] * values['players']
    let lambdaRequestsPrice = (lambdaRequests / 1000000) * 0.20
    let lambdaDurationSeconds = lambdaRequests * (values['lambdaMs'] / 1000.0)
    let lambdaGigSeconds = (values['lambdaRambda'] / 1024.0) * lambdaDurationSeconds
    let lambdaGigSecondsPrice = lambdaGigSeconds * 0.0000166667
    let dynamoReads = values['players'] * values['messagerate'] * Math.ceil(values['stateKbIn'] / 1.0) * values['duration']
    let dynamoReadsPrice = (dynamoReads / 1000000) * 0.25
    let dynamoRCU = Math.ceil(dynamoReads / (values['duration'] * 60))
    let dynamoRCUPrice = dynamoRCU * 0.00013
    let dynamoWrites = values['players'] * values['messagerate'] * Math.ceil(values['stateKbOut'] / 1.0) * values['duration']
    let dynamoWritesPrice = (dynamoWrites / 1000000) * 1.25
    let dynamoWCU = Math.ceil(dynamoReads / (values['duration'] * 60))
    let dynamoWCUPrice = dynamoWCU * 0.00065

    let subtotal = connMinsPrice + messagePrice + lambdaRequestsPrice + lambdaGigSecondsPrice
    
    let demandTotal = subtotal + dynamoReadsPrice + dynamoWritesPrice
    let provisionedTotal = subtotal + dynamoRCUPrice + dynamoWCUPrice

    outputBox.innerHTML = `
        <h4>API Gateway Costs</h4>
        <ul>
            <li>Messages: ${messages} = <b>$${messagePrice}</b></li>
            <li>Connection Minutes: ${connMins} = <b>$${connMinsPrice}</b></li>
        </ul>
        <h4>Lambda Costs</h4>
        <ul>
            <li>Requests: ${lambdaRequests} = <b>$${lambdaRequestsPrice}</b></li>
            <li>Execution: ${lambdaGigSeconds} Gig-seconds = <b>$${lambdaGigSecondsPrice}</b></li>
        </ul>
        <h4>DynamoDB Costs (Demand)</h4>
        <ul>
            <li>Reads: ${dynamoReads} = <b>$${dynamoReadsPrice}</b></li>
            <li>Writes: ${dynamoWrites} = <b>$${dynamoWritesPrice}</b></li>
        </ul>
        <h4>DynamoDB Costs (Provisioned)</h4>
        <ul>
            <li>Provisioned RCUs: ${dynamoRCU} = <b>$${dynamoRCUPrice}</b></li>
            <li>Provisioned WCUs: ${dynamoWCU} = <b>$${dynamoWCUPrice}</b></li>
        </ul>

        <h3>Totals</h3>
        <table>
            <thead>
            <tr><td>Mode</td><td>One Game Total</td><td>Cost for 1000 Games</td></tr>
            </thead>
            <tbody>
            <tr><td>Dynamo on Demand</td><td>$${demandTotal.toPrecision(8)}</td><td>$${(demandTotal*1000).toPrecision(8)}</td></tr>
            <tr><td>Dynamo Provisioned</td><td>$${provisionedTotal.toPrecision(8)}</td><td>$${(provisionedTotal*1000).toPrecision(8)}</td></tr>
            </tbody>
        </table>
    `
}

elements.forEach(element => {
    element.onchange = calculate
    //element.oninput = calculate
})

const updatePresets = (e) => {
    elements.forEach(element => {
        if(element.name in presets[e.target.id]) {
            element.value = presets[e.target.id][element.name]
        }
    })
    calculate()
}

document.querySelector('#rpsPreset').onclick = updatePresets
document.querySelector('#seriousPreset').onclick = updatePresets
document.querySelector('#lessDisk').onclick = updatePresets

calculate()

</script>
{{< /rawhtml >}}

The difference between the three presets is pretty remarkable.

Rock Paper Scissors costs $0.38/thousand games. This is, still, hard to beat from an instance-only point of view.

This is extra compelling when you consider that the cost is the same if you play all thousand games at once -- or spread them over a month. This is not something that's possible with the instance paradgim. Costs scaling to zero is extra helpful, because you can deploy your infrastructure in many regions if you want, for availability and user performance.

The 'more serious game' setting comes in at $334/thousand games, three orders of magnitude higher.
It's helpful to compare it with the 'less disk state' version, which only modifies how much state is read and written from DynamoDB -- it is $43/thousand games. So almost 90% of the cost of this high frequency, very interactive game ... is the state management. 

This points at an interesting hybrid architecture possibility, e.g. in AWS's [Building a serverless multi-player game that scales](https://aws.amazon.com/blogs/compute/building-a-serverless-multiplayer-game-that-scales/) they use Elasticache to be able to use Serverless to manage compute and user communications, but Elasticache (aka "RAM as a Service") to handle the state more cost effectively than storing it durably on disk.

## Conclusions

Where is the line between serverless and instances?

It seems instances still make sense for:

* Applications that need predictable, high volume and low latency responses (many requests/second, <100ms round trip time)
* Applications that need more than even a very small amount (10s of kilobytes) of state to make this type of high frequency decisions

Outside of that, especially when considering the total cost of ownership, security, maintainability, scaling to zero, and other nice factors of the broader serverless ecosystem -- I would be considering it as the option to rule out first.


<small><span>Cover Photo by <a href="https://unsplash.com/@florianolv?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Florian Olivo</a> on <a href="https://unsplash.com/s/photos/gamers?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Unsplash</a></span></small>