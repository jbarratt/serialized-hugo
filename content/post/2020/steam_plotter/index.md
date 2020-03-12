---
title: "A Pen Plotter at STEAM night"
slug: "steam_plotter"
date: 2020-03-12T16:32:47-07:00
lastmod: 2020-03-12T16:32:47-07:00
description: "A STEAM night at our elementary school was just the reason I needed to finally decide to get a pen plotter, the perfect combination of Technology, Engineering, Art and Math. Here's the story of that night (and the code for the activity.)"
summary: "A STEAM night at our elementary school was just the reason I needed to finally decide to get a pen plotter, the perfect combination of Technology, Engineering, Art and Math. Here's the story of that night (and the code for the activity.)"
draft: false
---

When I was a kid, my Dad had a large format pen plotter, which he used to create mechanical drawings and massive wiring diagrams for the specialized generators he designed.

I used to watch it work for hours, fascinated by the precise movements and perfect lines as the machine hummed and chunked.

So, when I started seeing more modern pen plotters pop up online, it pushed a button deep inside that I'd almost forgotten was there. After keeping an eye on them for a few years, I finally had a reason. My kids all go to a local elementary school, and the person who'd done a lot of work for the annual STEAM night had moved on. They needed help to create activities. What's more STEAM than a pen plotter! Technology -- easy. Engineering -- yes. Art -- totally! Math -- absolutely. Plus, robots are cool.

So I got the plotter I'd had my eye on for a while -- the Evil Mad Scientist [AxiDraw V3](https://shop.evilmadscientist.com/productsmenu/846), a beautiful precision writing machine.

I've had a lot of fun with the plotter already since getting it, and I'm sure it will be the subject of some additional posts over time. But for this post, I'm sticking to STEAM night.

## The Activity

The goal: something that was

* interactive for the kids -- I didn't want it to be a static "exhibit"
* reasonably quick to draw -- more complex plots can take hours.

I settled on getting some [high quality 5" x 8" blank cards](https://www.amazon.com/gp/product/B077Q9M4GP/), with the idea that kids could create a customized namecard, that would hopefully be tough enough to handle being carried around through the rest of STEAM night with them!

It ended up working like this:

![Exercise Architecture](STEAM_architecture.svg#full-width)

* They lined up at a table with a full screen browser window looking at a Namecard Maker app [(Live Demo to play with)](http://snap.serialized.net/namecard/index.html), where they could enter their names. (Or, a suprisingly sweet second most frequent entry, "I Love You Mom")
* After they were happy with the word and font choices, they hit Print It. This POST'ed the SVG content to a [tiny backend daemon](https://github.com/jbarratt/STEAM_plotter/blob/master/backend/server.py).
* A modal dialog let them know to let the next person in line make a card, and to move to the printer
* After they picked a pen and the printer was set up, they clicked a button on a cheapie USB gamepad. This woke up [another tiny daemon](https://github.com/jbarratt/STEAM_plotter/blob/master/backend/printer.py), which actually sent the SVG to the plotter.

Here's how it looked in real life:

![The Plotter at Work](table.jpg#center-wide)

There was also a posterboard set up, channeling the ghost of science fairs past:

![Posterboard](posterboard.jpg#center-wide)

Everything on the board was printed by the robot, which made for some fun conversations!

* The title text, made in Inkscape using an EMSL extension for [Hatch Filling](https://wiki.evilmadscientist.com/Hatch_fill)
* A photo made with [StippleGen](https://wiki.evilmadscientist.com/StippleGen)
* My first attempt at SVG generation for the plotter, the straight lines making the "dreamcatchers", something I used to do with a ruler when bored in math class
* 2 sample name cards printed by the program
* A map of Portland, generated from [City Roads](https://anvaka.github.io/city-roads/), which looks incredible close up
* And an high level "how does this work" diagram, made with [OmniGraffle](https://www.omnigroup.com/omnigraffle), and with text added afterwards in Inkscape using the [Hershey Text](https://www.evilmadscientist.com/2011/hershey-text-an-inkscape-extension-for-engraving-fonts/) extension.

## Reactions and Ideas for next time

Overall, it went super well. My stats show we were able to print 85 cards, which is just under 1 card a minute for the whole time the STEAM night was in progress!

The kids really enjoyed it -- and the adults did too. There was a line the whole time and lots of people just hung out to watch. Seeing a drawing robot at work is mesmerising!

There were a few glitches:

- Pen positioning is somewhat tricky, we had a few cards where the pen was too close (extra lines) or too far away (no lines). I didn't have a good way to say "print the last card over", so that interrupted the flow a few times.
- The USB HID driver threw a few errors that I didn't catch during testing, which crashed the plotter script. I think having a separate laptop for the kids to use to make the cards vs the one that controls the plotter would be smart next time, as this required asking the line to back up while tinkering happened.

The biggest improvement for next time is to get more into the  "how it works". Especially with the demand, it ended up being pretty much a rush through things, with the whole experience being somewhat of a black box to them. There's probably only so much you can do with the K-5 age range, but I've got a year to think about how to get that part better!

## Digging deeper

If you want to check out the code, it's all on github: [jbarratt/STEAM_plotter](https://github.com/jbarratt/STEAM_plotter)

There's some documentation in the repo, and a folder for the frontend app and a different one for the backend.


A lot of the heavy lifting was done with [maker.js](https://maker.js.org). 
The core text generation part of the namecard app turned out to be the following:

```javascript
// Once the font is loaded, maker.js handles turning (the text string + the font)
// into a set of SVG-capable paths. This was incredibly helpful!
var textModel = new makerjs.models.Text(font, text, 100, false, false, undefined);

// Since this needs to get printed on a real physical card, use physical measurements (Inches) 
textModel.units = makerjs.unitType.Inch;

// Measure the actual size of the text model that was generated
var measure = makerjs.measure.modelExtents(textModel);

// Figure out the scaling factors to get it to a 4" x 7" H/W
yScale = 4/measure.height;
xScale = 7/measure.width;

// Use the smaller scaling factor for both axes, so it will either be
// 7" wide or 4" high, and the other axis will be correctly scaled.
textModel = makerjs.model.scale(textModel, Math.min(yScale, xScale));

// center the (rescaled) model
makerjs.model.center(textModel);
```

At some point it will stop being so impressive what you can do with purely browser-side code, but for now, it's exciting every time. Especially since I tried turning (font+text string) to SVG paths in python first, and it was, well, not nearly so straightforward.

Overall I'm extremely happy both with the plotter and the experience of taking it to school. Thanks to EMSL for creating such an awesome machine and for all the excellent software they (and the community) have created to bring it to life.
