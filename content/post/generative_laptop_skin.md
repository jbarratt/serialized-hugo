---
title: "Generative Laptop Skin"
slug: generative-laptop-skin
date: 2018-07-15T21:19:10-06:00
lastmod: 2018-07-15T21:19:10-06:00
description: "Generative Art as a laptop skin"
draft: false
---

When I started at [SendGrid](http://sendgrid.com) I was handed a brand new Macbook Pro.

I've never bought myself a MacBook, but it's been the standard issue for every employer since they came out 12 years go. Every time I've gotten a new one, I get an uncontrollable urge to protect the pristine plane of clean aluminum from scratches and scuffs. I'm also not a fan of the "throw random stickers from conferences and meetups" approach to laptop decor -- there's enough chaos happening in my inbox and calendar, I need sanctuary somewhere!

My go to sticker provider for many years has been [Gelaskins](https://www.gelaskins.com/). They have a great collection of excellent art that you can get on stickers meant to fit most popular devices -- but you can also upload your own images. I've found these stickers to be very durable, look great, go on without bubbles, and come off with out leaving stickerjunk™ behind.

While in the SendGrid onboarding (which was comprehensive and excellent) I noticed the slide template had a cool pixel grid on the bottom of it, made up of SendGrid colors.

On closer inspection, it turned out to be made of a small set of fixed colors, and to follow a simple rule: "No cell should share a side with cells of the same color."

![small example](/generative/3_by_5.png#center)

This turns out to be a pretty straightforward thing to generate arbitrary sized versions of.

1. Get a pool of at [least 4 colors](https://en.wikipedia.org/wiki/Four_color_theorem)
2. Start with an empty field
3. Starting in the top left corner, going left to right, then row by row,
  * select a random color from the pool
  * ensure that the colors to the left and above of that cell are not the same color (or the edge of the grid)
  * If they are, cycle through the available colors until a valid one is found

It was a little suprising, in a good way, that you only ever need to check 2 edges per cell, and you can satisfy the constraint that all 4 edges have distinct colors.

I grabbed the 'on-brand' colors and made a quick `main.go` implementing this algorithm and it worked!

![laptop](/generative/laptop.jpg#center)

When thinking about making a short post about this, I realized that I've wanted to play with [gopherjs](https://github.com/gopherjs/gopherjs) for a while -- and this seemed like an interesting test case.

It was shockingly and delightfully easy to make this code run on the web.

First, you need a `main()` function which registers the JS function. I made the function return a [Data URI](https://en.wikipedia.org/wiki/Data_URI_scheme) with the PNG content so it can be directly set as an image's `.src` attribute.

```golang
func main() {
	rand.Seed(time.Now().UnixNano())
	js.Global.Set("generateImage", func(rows int, cols int, size int, c1 string, c2 string) string {
		output := new(bytes.Buffer)
		_ = render.GenerateImage(uint(rows), uint(cols), uint(size), c1, c2, output)
		b64Png := base64.StdEncoding.EncodeToString(output.Bytes())
		return fmt.Sprintf("data:image/png;base64,%s\n", b64Png)
	})
}
```

With a `main.go`, all that's needed is to run

```bash
$ gopherjs build --minify
```

and it works!

To use javascript, include the script:

```
<script src="stickergen.js"></script>
```

And then call the function:

```
var img = generateImage(rows, columns, cellsize, firstColor, secondColor)
```

The returned value is a Data URI encoded PNG, so can be assigned as the `src` attribute of an `img` element. Example usage:

```
<img id="targetImg"></img>

...
myImg = document.getElementById("targetImg")
myImg.src = generateImage(40, 80, 9, "#f21326", "#eac4f9")
```

For this specific use case, it probably would have been vastly more efficient (at least from a code size perspective) to have re-implemented the algorithm in native javascript. Even minified this transpiles to 1.8MB of code. (Though, it does gzip to 377kb, which is still heavy, but closer to reasonable.) At the same time, it *does* work, and having a shared codebase is pretty amazing.

You can check out the full code at [jbarratt/stickergen](https://github.com/jbarratt/stickergen).

And, here it is. You can pick 2 colors; the code uses [go-colorful](github.com/lucasb-eyer/go-colorful) to try and find pleasant looking colors in between the two you've selected. I've found I like the results better when a light and dark color are used.

<p>
  <span>Color #1:</span>
  <input type="text" id="color1" class="colorPicker" value="#3f43bf">
  <svg id="d1" style="display:inline;" height="15" width="15">
    <rect x="0" y="0" width="15" height="15"/>
  </svg>
</p>
<p>
  <span>Color #2:</span>
  <input type="text" id="color2" class="colorPicker" value="#11e4e4">
  <svg id="d2" style="display:inline;" height="15" width="15">
    <rect x="0" y="0" width="15" height="15"/>
  </svg>
</p>
<style>
  img.imgCenter {
    margin: 0.7rem auto;
    max-width: 90%;
  }
</style>
<img src="#" id="genImg" style="display:none" class="imgCenter"></img>
<link href="/generative/color-picker.min.css" rel="stylesheet">
<script src="/generative/stickergen.js"></script>
<script src="/generative/color-picker.min.js"></script>

<script>
  var c1 = document.getElementById("color1")
  var c2 = document.getElementById("color2")
  var d1 = document.getElementById("d1")
  var d2 = document.getElementById("d2")
  var gImg = document.getElementById("genImg")
  function updateImage() {
    d1.setAttribute("fill", c1.value);
    d2.setAttribute("fill", c2.value);
    gImg.src = generateImage(40, 80, 9, c1.value, c2.value)
    gImg.style = "display:block"
  }

  var target = document.querySelectorAll('input.colorPicker');
  // set hooks for each target element
  for (var i = 0, len = target.length; i < len; ++i) {
      (new CP(target[i])).on("change", function(color) {
          var newVal = '#' + color;
          if (this.target.value === newVal) {
            return
          }
          this.target.value = newVal
          updateImage()
        });
  }
  updateImage()
</script>
