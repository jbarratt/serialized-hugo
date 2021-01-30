---
title: "Make-ing Mermaid"
date: 2019-08-13T23:45:26Z
lastmod: 2019-08-13T23:45:26Z
description: "Sequence Diagrams and Flowcharts are very useful tools. Mermaid is an excellent library to create them which can be driven from the command line, and therefore improved with some unixy magic."
summary: "Sequence Diagrams and Flowcharts are very useful tools. Mermaid is an excellent library to create them which can be driven from the command line, and therefore improved with some unixy magic."
slug: "mermaid"
---

[Sequence diagrams](https://en.wikipedia.org/wiki/Sequence_diagram) are a very useful way to communicate about how processes work, especially when there are multiple services (or other actors) at play. A typical component-oriented diagram starts to suffer when there are several calls back and forth between the same systems, for example.

In the past I've used [PlantUML](http://plantuml.com/sequence-diagram), [websequencediagrams.com](https://www.websequencediagrams.com/), and [Sequence Diagram](https://apps.apple.com/us/app/sequence-diagram/id1195426709?mt=12) from the Mac App Store.

Recently, though, I've been really enjoying [Mermaid](https://mermaidjs.github.io/#/). 

* It has a nice, simple, syntax
* It generates `png` and `svg`, and both can be styled using CSS
* You can render mermaid diagrams right in a browser (for example, [in hugo](https://www.hairizuan.com/rendering-diagrams-in-hugo/), which I haven't done yet)
* There's an online [live editor](https://mermaidjs.github.io/mermaid-live-editor/)
* It can also run [from the command line](https://github.com/mermaidjs/mermaid.cli)

## Running mermaid from the command line

Yes, it's inevitable. If I can run it from the command line, I will.

At this time, there's a stated issue in the CLI's README which suggests doing a local install.
This works fine; the automation steps listed here assume they're based off of that. If you're not doing the local install, just update the path to `mmdc` to be wherever it is on your system.


### Makefile magic

`make` is a classic tool for a reason. For pretty much any application where some source files (and maybe other files, like configurations) end up being used to generate an output file -- `make` can help.

Here's the file I've used to mostly automate working with mermaid.

```Makefile
all: $(addsuffix .png, $(basename $(wildcard *.mmd)))

%.png: %.mmd style.css config.json
	./node_modules/.bin/mmdc -C style.css -w 2048 -H 1536 -c config.json -t neutral -i $< -o $@
	exiftool -Source"<=$<" $@
	open $@
```

Which results in this process, helpfully illustrated by mermaid:

{{< img src="/images/mermaid/mermaid.png"  alt="mermaid"   class="full-width"  >}}

This is some `make` superpowers.

```Makefile
all: $(addsuffix .png, $(basename $(wildcard *.mmd)))
```

Because the target `all` shows up first, it's the default, so it runs if you just run `make`.

`all` uses a few `make` builtins to say "for all the mmd files" (aka mermaid sources), remove the mmd (`basename`), and add `.png` instead".

So, if in the directory you have `first.mmd` and `second.mmd`, the `all` target will have `first.png` and `second.png`.

```Makefile
%.png: %.mmd style.css config.json
```

This section, with the `%`, is a [pattern rule](https://www.gnu.org/software/make/manual/html_node/Pattern-Rules.html). 

It creates automatic rules for targets. So any (nonexistent, at least on the first run) `.png` file names that got added to `all` in the first stepwill get matched. They'll automatically depend on both the matching `.mmd` file, as well as getting rebuilt if the `config.json` or `style.css` files get updated.


Inside the pattern rule block, there are 2 special variable names: `$<` (the input file) and `$@` (the output file.)

```Makefile
	./node_modules/.bin/mmdc -C style.css -w 2048 -H 1536 -c config.json -t neutral -i $< -o $@
```

To make a given png, it'll run the  mermaid CLI tool with a bunch of configuration, including `$<` (the `.mmd` file) for input and `$@` (the `.png` file) for output.

The `exiftool` command -- we'll get to in a minute.

And the final line (`open $@`) uses the OS's open tool to show you the resulting image. (YMMV outside of MacOS, but I trust that if you're generating images from text based markup, you can figure out how to view an image on the platform of your choice.)

And that's it! A nice png file, delivered by mermaid.

A similar process can be done to generate svg files, which are generally preferable ... except when inserting them inside Google Docs, which is what I tend to do with these sequences.

### Dark trickery with `exiftool`

Mermaid files are plain text, which can be used to generate images as we've seen here.

But what if it's time to update a diagram -- the sequence diagram is there in the document, it's _almost_ right, but it needs some updating.

Hopefully, the original file is in git somewhere, helpfully version controlled ... but a lot of times documentation flows don't get the same kind of engineering toolchain love as something like source code would. So, maybe, it's just an image. And yes, looking at the above, you could probably type this back in:

```
sequenceDiagram
	user ->> make: run
	make ->> files: any files changed?
	alt No Files Changed
		make -x user: nothing to make
	end
	make ->> mermaid: build png
	mermaid ->> make: return status
	make ->> exiftool: add mermaid source to image
	exiftool ->> make: return status
	make ->> open: Open file
	open ->> user: Check out this file
	make ->> user: Build complete

```

but there's got to be a better way.

I am lucky enough to work with [Sean Kilgore](https://twitter.com/log1kal), aka `@log1kal`, and he found this problem particularly troublesome. 

Which explains the `exiftool` line of the `Makefile`, his truly excellent addition:

```
  exiftool -Source"<=$<" $@ 
```

Using some creative syntax, it includes the entire source file being used to generate the image into the `Source` tag of the `png` file.

This is cool stuff, because it can be recovered. Using a simple shell script like `recover_source.sh`:

```shell
#!/usr/bin/env bash

exiftool -s -j -Source $1 | jq -r .[0].Source
```

`-s` reads the tag value, `-j` prints the structure as json, `jq` then picks the source attribute from the resulting document, and it's `-r` argument means it actually prints whitespace and newlines for real, instead of as escape codes.

So, does it work?

Here is a Google Doc, with a mermaid image inserted via `Insert > Image`.

{{< img src="/images/mermaid/g_doc_shot.png"  alt="google doc screenshot"   class="center-wide"  >}}

Sadly, there's not clear way to do a right-click "Save Image", but `File > Download > Webpage` will give a zip file with HTML and all the other assets.

```
$ unzip -l Test\ Mermaid.zip 
Archive:  Test Mermaid.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
     2676  08-13-2019 22:48   TestMermaid.html
    36923  08-13-2019 22:48   images/image1.png
---------                     -------
    39599                     2 files
```

and ... sure enough, it works!

```
$ ~/work/mermaid/recover_source.sh image1.png 
sequenceDiagram
	user ->> make: run
	make ->> files: any files changed?
	alt No Files Changed
		make -x user: nothing to make
	end
	# ... rest cut because you've seen it already
```

It's not perfect. 

* it's kind of a pain to download a zip file and extract the contents
* If someone copy-pasted the contents of the image (e.g. from Preview) it doesn't preserve the metadata.

But, it's still better than nothing, and folks that care about it working would know to avoid the copy/paste issue.

And yes, the images in this blog post come with source included, if you want to try it out.

### Making it even more automatic

One final target can be added to the `Makefile` for extra fun:

```Makefile
watch:
	fswatch -o . | xargs -n1 sh -c 'make all'
```

This uses the open source [fswatch](https://github.com/emcrisostomo/fswatch), a cross-platform file change watching tool, to automatically re-run Make when things in the directory change. 

So, just run `make watch`, leave that running in the background, and work with your editor of choice in the other. Creating new `.mmd` files magically leads to new images popping up, as does editing existing ones, or changing styles.

And just for fun, here's that process via mermaid:

{{< img src="/images/mermaid/flowchart.png"  alt="fsevents"   class="center-wide"  >}}

and the source:

```
graph LR
	makewatch[$ make watch]	
	make[$ make]	
	filesystem((Filesystem))

	makewatch --> fsevents
	fsevents-- watches --> filesystem
	fsevents-- runs --> make
	vim -- writes to --> filesystem
```

Happy Mermaiding!
