---
title: "A workflow for sharing Markdown (with images!)"
date: 2018-11-28T21:52:37-08:00
lastmod: 2018-11-28T21:52:37-08:00
description: "Making markdown notetaking a little richer"
summary: "S3 and Cloudfront make a great combination for sharing assets. Throw in some pandoc and you can easily share rich notes with others."
draft: false
---

*Update*: Monosnap is no longer free, so this method doesn't work any more. `:sadtrombone:`

Markdown is great. It's what is used for this blog, but I also enjoy it for other kinds of writing, like documents and notetaking.

When writing in Markdown, I feel more focused and "in the zone", perhaps because it's just me and the (relatively lightly distracting) editor, and I'm so much more likely to be able to go fully mouseless.

Restructuring documents is also far simpler, especially when you use [folding](https://en.wikipedia.org/wiki/Code_folding).

The cross-platform nature helps, too. I have my notes in Dropbox, so I can pull them up in [Editorial](https://omz-software.com/editorial/) on my iPad, work on them when SSH'd into a machine via `vim`, or use them on the Mac in Atom with live preview. And they're extremely searchable, via grep or more [modern alternatives](https://github.com/monochromegane/the_platinum_searcher).

Especially for technical notes, the ability to make a code block is key. Certainly it's great for adding a fragment of code, but it's also handy for adding a little light structure to some text.

```
something
   kind of
      like this
   where there's visible structure --> but not using anything formal
```

Today I was doing something I often do when learning about things -- watching a video and taking notes. I think it helps the ideas 'stick' better, as well as being able to reference and search the notes later.

(Aside, it was a great [video about DynamoDB](https://www.youtube.com/watch?v=HaEPXoXVf2k) by Rick Houlihan. I was so excited about it I tweeted. And then got [retweeted by a database](https://twitter.com/dynamodb/status/1068014679463587840). So I guess you could say things are going pretty well for me.)

### Getting images into Markdown

Some of the slides had fantastic visuals on them, which it felt crazy to try and fully describe with text. "Hm, I need something like a markdown editor, but that supports pasting images into... some kind of hybrid between Google Docs and this Atom setup?"

But suddenly I realized that you *can* (sort of) paste images into a markdown document -- at least, if you have a URL for that image. And I also have a very easy way to get links for images, using a tool called [Monosnap](https://monosnap.com/welcome).

How to do this:

1. Download and install Monosnap. *(Warning, it does report usage stats to Google Analytics, but at least they're honest about it. If you don't like that, there are alternative tools that work similarly.)*
2. Create and configure a S3 bucket to be readable. (A rare reason to do this intentionally! In general, secure your buckets, folks.)
2. Generate an IAM keypair just for monosnap, and give it a profile which *only* has read/write access to the bucket in question.
3. In Monosnap, configure S3, select your bucket, and make S3 the default file storage option
4. Check the Advanced tab, and ensure the filename pattern is something you'd like -- for example, I'm not a fan of having the window title as part of the name.

Once that's done, any time you hit the hotkey (`⌘-⌥-7` by default) a screenshot picker appears. You take the shot, and a second or two later, a shareable URL is in your clipboard.

From here on out, it's easy to add to markdown:

```
![alt text for screenshot](Paste in the URL)
```

Putting it all together:

{{< img src="/images/md_wf/small_example.png"  alt="example screenshot"   class="center"  >}}

### Getting Markdown to Others

This was exciting stuff! I shared it with a friend who I knew also to be afflicted by my (arguably unreasonable) fandom of Markdown -- and he was suitably enthused.

"But alas" he lamented, "it is so troublesome to share one's hard-crafted Markdown with those who do not appreciate the stark beauty of that structure's native form." *(Ok, I may be paraphrasing.)*

Having just set up a way to share public images, the concept was fresh. Translating Markdown to HTML is a well-solved problem. Copying files to S3 is a well-solved problem. This seemed like a few short lines of shell away from quite doable!

After poking around a bit, I found a very nice [markdown style sheet](http://benjam.info/panam/), and from there it was as straightforward as hoped. This is a very rough and ready script, but it does the job very well for a few minute's tinkering.

```bash
# Exit if any command in this script fails, no point continuing if any step explodes
set -e

# Generate a random string made of upper/lowercase letters and digits
PATHNAME=$(python -c "from random import choice; print ''.join([choice('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') for i in range(10)])")

# Call pandoc to convert md -> HTML, embedding the CSS script in the header
# Write the HTML to standard out and send to aws s3 cp to upload the file
pandoc -H /path/to/styling.css -V lang=en -V higlighting-css -f markdown+smart --to=html5 $1 -o - | aws s3 cp - s3://$MY_BUCKET/md/$PATHNAME.html --acl public-read --content-type "text/html"

URL="https://s3-$MY_REGION.amazonaws.com/$MY_BUCKET/md/$PATHNAME.html"

# Print out the URL to the console (tee doesn't work here for some reason?)
echo $URL
# and then also write it to the clipboard for ease of sharing
echo $URL | reattach-to-user-namespace pbcopy
```

Here it is in action. (The warning is ok; using the filename as a default title actually works for me.)

```bash
$ ./mdshare ~/Dropbox/notesy/example.md
[WARNING] This document format requires a nonempty <title> element.
  Please specify either 'title' or 'pagetitle' in the metadata.
  Falling back to 'example'
https://s3-us-west-2.amazonaws.com/serialized-public/md/vAKmDl1mGQ.html
```

You can [visit the page](https://s3-us-west-2.amazonaws.com/serialized-public/md/vAKmDl1mGQ.html) if you want!

And if you don't feel like clicking, here it is with the stylesheet applied.

{{< img src="/images/md_wf/rendered_web.png"  alt="with stylesheet"   class="center"  >}}

So, all in all, a productive evening! I now have the ability to take rich notes for myself in markdown, and share decently looking, media-enhanced, rendered markdown with others with very little effort.
