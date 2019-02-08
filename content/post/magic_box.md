---
title: "Designing Systems with The Magic Box"
date: 2019-02-07T21:13:35-08:00
lastmod: 2019-02-07T21:13:35-08:00
description: "Designing better software with magic boxes"
slug: "magic_box"
draft: false
---

<style>
img[src$='#center-wide']
{
    display: block;
    margin: 0 auto;
    width: 75%;
    max-width: 90%;
}
</style>

I've been using an exercise for many years when doing early stage system design. It's almost certainly inspired by something I read or was taught, but the origins are lost in the twisty passages of my memory. Please let me know if there are sources I should cite!

After sharing the concept with a few folks, and having them find value in it as well, I realized I'd never actually written it down.

Here's the situation: we're trying to throw some software at some kind of problem. Maybe we have some requirements, or we have some kind of spec, and it's time to refine those and get started on the design.

My own default, as well as most of the engineers I work with, is to start with architecture -- physical or logical. But thinking at a more conceptual level first can be extremely helpful. Here's how it works.


### Step 1: Draw a magic box

First, grab a whiteboard, or a page in a notebook, open OmniGraffle, it doesn't matter -- and draw a box. 

This is a magic box. 

It does everything we want it to. 

How? Doesn't matter yet. It's magic. Maybe we name it. But don't think too hard about naming it. Naming things (well) is hard, this is just a magic box.

![step one](/images/magicbox/s1.svg#center-wide)

Maybe you have an idea about the technologies you'll use inside this magic box. For this exercise, **forget all about them**. The box is magic, for now, we're not thinking about *how* the magic works. We're just thinking about *what* the box does.

Forgetting the implementation details is a crucial step. For a lot of systems, thought starts with a certain stack. If you have an idea that "I'm building a service with API Gateway, Lambda, Go, and DynamoDB" that will likely influence a lot of your design in ways both blatant and subtle, and it will impact even things like how you discuss the problem. Deferring that step very intentionally helps keep the early conversation rooted in the *what we are doing* and *why we are doing it*.

Using this constraint also helps when working with less technical but essential partners, such as Product Managers. "This system transforms customer records so they can be sent to a payment processor" is both more meaningful and inclusive than "JSON gets written to Kinesis and then the Lambda ..."

### Step 2: What goes into the box?

Draw one or more arrows pointing into the box. What goes in? What sorts of questions do we ask it? What gets given to it to store? Are there any other sources of data it needs? How will we know if someone is allowed to talk to this box? (Authentication, Authorization.)

![step two](/images/magicbox/s2.svg#center-wide)

### Step 3: What comes out of the box?

What kind of information does the box return for queries? Does it need to pass any information on to other systems? Does it need to send out any alerts, logs, traces, or metrics?

![step three](/images/magicbox/s3.svg#center-wide)

<small>Also, given that I am a dad, I am legally allowed to tell you that the alternative title for this step is 🎼"What does the box say?" 🎶</small>

### Step 4: What does the box know?

What kinds of information does the box need to have to answer the questions from Step 2? Where will it get that from?
What kind of information will people want the box to store? What will it be responsible for? What kind of rules might there be around keeping that data safe? (Does any of it need to be encryped, or pseudonymized, or have a retention policy?)

![step four](/images/magicbox/s4.svg#center-wide)

### Step 5: Let's talk numbers

Look at the arrows and the notes you've made about the system, and start to put some numbers on them.


![step five](/images/magicbox/s5.svg#center-wide)

Good numbers to start thinking about are:

* How many queries per second, or per day, does it need to be able to support?
* How many system interactions will be happening in parallel at any time?
* How much data will it be storing?
* How fast will data be coming in? How quickly will the stored data be growing?
* How fast does it need to answer queries, 95% of the time and 99.9% of the time?
* How often should this box be available? (or how much can it be unavailable?)

I like to actually add the numbers into the diagram. It helps visually show you the kinds of areas you haven't thought through yet.

These can (and probably will) be wild guesses -- some of them might be provided in requirements, as well. But it's good to think about rough values for all of them, both early on in the life of the (non-magical, actual service) and how it might look after being around for a while.

People often struggle with being concrete here. At this stage, just make up anything. It's a starting point to which to tune. "What should the response time SLA be" is a harder way to think about it than "is it ok if these things return answers in 1/2 a second? Does it need to be faster?"

The various metrics and measures you take out of a production system are often going to be dependent on the implementation. I may or may not care about CPU utilization, or free connections, or iops, or any of the other important, but implementation-dependent, details.

This stage is a really interesting one to think about metrics. Independent of whatever the implementation turns out to be, what things are useful to track? Maybe it's the latency to submit a certain kind of question, or the number of users actively on the system. It can help to think through the key measures that are really at the heart of why this system exists at all, before bringing in the noise associated with "how we keep it running smoothly."

### Step 6: **Now**, what's *inside* the box?

Congratulations. You have a much clearer picture of what, exactly, needs to be true about the system you're designing -- before you start designing it. 

It's common at this point for the exercise to become a little bit of a fractal. Sometimes what's inside the box is concrete, e.g. "some code in a container on a scheduler with a load balancer and a data stores", but for more complex systems, it can make sense to think in terms of more magic boxes inside the magic box, and do the exercise again at the lower levels.

![fractal](/images/magicbox/fractal.svg#center-wide)

The information from the magic box exercise can also be incredibly helpful for creating documentation.  Far too much technical writing about systems gets "inside the box" within the first paragraph. As someone trying to get up to speed on lots of designs quickly, I often find myself wondering "ok, cool, but what does it *do*?" This exercise provides the most important context for the engineering decisions that come after, and a framework for understanding them.


## A Magic Box Example

Imagine a system which helps you reach time-based goals. You text it things like "I want to run 40 miles by the end of March", then you can text it updates like "I ran 3.5 miles." It'd send you occasional messages if it's been a while since an update, or when you're behind schedule. "Step up your game, you need to run an average of 2.2 miles a day to hit your goal!"

### Step 1: Draw the box

I'm going to call my magic box "CoachBot" for now. That's probably taken, but picking a good name is a whole thing.

![coachbot one](/images/magicbox/cb1.svg#center-wide)

### Step 2: What goes into the box?

![coachbot two](/images/magicbox/cb2.svg#center-wide)

* Goal creation messages, like "I want to meditate 100 times by 2020"
* Goal update messages ("I meditated")
* We'll probably want to let people off the hook ("Remove meditation goal" or maybe "Forget about that meditation thing, what was I thinking", "STOP", "Unsubscribe")
* Maybe they'll want status ("how am I doing", "what are my goals")
* They might want to know what they can ask ("help")

### Step 3: What comes out of the box?

![coachbot three](/images/magicbox/cb3.svg#center-wide)

Some responses to the user:

* Confirmations ("goal created", "goal cancelled")
* Statuses ("you need to meditate 13 times a day to hit your goal")

It'd probably be good to have logs of all actions for troubleshooting and bugfixes.
Also, I'd want to know how long it took to reply to any questions.


### Step 4: What does the box know?

![coachbot four](/images/magicbox/cb4.svg#center-wide)

It needs to keep some information about every goal:

* creator's phone number
* goal name/activity
* start date
* target date
* date last nagged
* date last updated
* dimension (distance, time, count, etc)
* units (miles, hours, count)
* target amount
* current amount

That's about it, though the phone number is personally identifiable information, so it would ideally be replaced with a hash of the number or something similar. We do want to be able to 'nag' them though, so the number probably needs to be kept around in some way, perhaps more secured. Or, the whole data set could be encrypted.

### Step 5: Make Up Numbers

![coachbot five](/images/magicbox/cb5.svg#center-wide)

Here are some examples of key numbers I like to think about.

* Even if this service is really successful, it's hard to imagine it handling more than **1 update per second**.
* We'll probably have less than **100k** goals in the system, ever
* Since there's not much data to store for a goal, (< ~10kb/record) it's maybe **1GB**?
* I want this service to work pretty reliably, but I'd be fine with some user delay; let's say **99.95%** (20 minutes a month) is ok.
* It should feel pretty snappy. If I send a text I'd like a reply within **500ms**.


### Step 6: Look inside the box

It's time to design the system. 

... which is for another blog post.

The work done here is incredibly valuable for the design process. Having already thought about the interfaces, things that need to be measured, things that need to be logged, characteristics of the data storage/access, and dependencies to other services -- provides a huge step up. It enables thinking about about different designs along the lines of 'how well do they fit the parameters we have called out here' vs just directly comparing/constrasting on general technical (or preferential) merits.


## Magic Box Away

Hopefully this process is valuable. I haven't used it 100% of the time on recent projects, but in the process of writing it up, I believe that they'd all have been improved by doing it.

I'd love feedback if you try it!
