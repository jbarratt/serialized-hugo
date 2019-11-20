+++
date = "2017-06-06T11:48:34-07:00"
description = "Notes on a move from Nikola to Hugo"
title = "Moving from Nikola to Hugo"
+++

As part of my recent [Move to Hugo]({{< relref "migrated_to_hugo.md" >}}) I wrote a few small tools that may be useful (with tweaking) for someone else doing the same, or moving from a similar static hosting platform.

### Basic configuration

I was extremely happy to find that I could keep my existing permalink structure just by editing `config.toml`:

```toml
[permalinks]
    post = "/:year/:month/:title/"
```

### Importing content

The first part of content was easy, as Nikola and Hugo have very similar methods for storing static files. I just had to copy the contents of my `serialized-nikola/files` tree to my `serialized-hugo/static` tree. 

The next part was a little trickier. Nikola:

* Supports Restructured Text, which I used for a few posts
* Has a different frontmatter format (Restructured Text style, wrapped in HTML comments for markdown)
* Has a different date syntax -- actually, supports more flexible dates, so I had several syntaxes in play.

I had enough posts (137) that doing this by hand would have been not fun at all, so of course, I [scripted it](https://github.com/jbarratt/serialized-hugo/blob/master/tools/import.py). It's not a generically useful script -- I even hard coded in some of my paths -- but if you're doing a similar migration it might be a good starting point. Nikola has a crazy-high degree of flexibility, this script specifically only handles the subset of what I was using.

Please also note, for these one-and-done scripts I tend to ignore my typically rigorous testing and error checking habits. :grin:

Here's the process:

<img src="/images/hugo_nikola_process.svg" alt="conversion process" width="100%">

Yet again, [pandoc](http://pandoc.org/) to the rescue, as it made converting from Restructured Text to Markdown a breeze.

```python
    args = ['pandoc', '--from=rst', '--to=markdown', '--output=-']
    args.append(srcpath)
    data['content'] = subprocess.check_output(args)
```

I went through the majority of the posts by hand, and there were only a few things that got left behind (that I noticed), like YouTube embed codes, that were easy to fix up by hand. It was really incredible to run the script and in a matter of seconds have the livereload refresh to reveal a fully functional site.

### Spring Cleaning

While I was migrating, I realized there were a lot of images and random other files which were no longer used, many from posts which I had retired long ago. Almost all static site generators (including hugo) do struggle with image/post locality; there's a good [discussion in a github issue.](https://github.com/spf13/hugo/issues/1240). Because of this, I had about 500 files in my `static/` directory, and I had no idea which were still being referenced or not.

> **Update 2019-09-24:** Today I learned that Hugo fixed the above problem a few years ago. As of 0.32 (6 months after this was posted) you can do [page bundles](https://gohugo.io/content-management/page-bundles/). This means instead of `content/post/mypost.md`, you can do `content/post/mypost/index.md` and also put images in `content/post/mypost/myimage.png`, where you can refer to it in markdown as `![my image](myimage.png)`. Super convenient and A+ lovely for organization. Thanks Hugo!

Thanks to all the posts being in markdown, I realized the paths would have to show up in those files, so built out a simple tool to

* find all the files in `static/`, and normalize the paths to match what they actually look like from the webserver
* Open every file in the content tree, and keep track of any of the static file paths which appear in them
* Output all the static files which have zero references

This tool is in go: [unused_images.go](https://github.com/jbarratt/serialized-hugo/blob/master/tools/unused_images.go).

Go's, unsuprisingly, very powerful when doing this kind of task. A snippet showing the gathering process:

```go
var seen map[string]int

func findImages(path string, f os.FileInfo, err error) error {
	imageRe := regexp.MustCompile("images/.*$")
	seen[imageRe.FindString(path)] = 0
	return nil
}

func main() {
    ...
    seen = make(map[string]int)
    filepath.Walk(images, findImages)
    ...
}
```

It ran seemingly instantly, and spit out a list of over 100 files that could be deleted, which is excellent (and 100 images fewer to have to check state on every time the deploy/sync process runs.)
