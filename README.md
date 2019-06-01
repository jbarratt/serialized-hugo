### Source code for serialized.net

This is the code for my personal blog, based on hugo.

To deploy it I use [s3deploy](https://github.com/bep/s3deploy).

To visualize the site locally:

  $ hugo server --verbose --bind 0.0.0.0

To make a new post:

  $ hugo new post/$(date +"%Y")/mypost.md

There are some tools in the `tools/` directory:

* `deploy.sh`: cleans, builds, runs s3 deploy, and does a cloudfront invalidation on `/`
* `unused_images.go`: `go run unused_images.go static/images content` and it will identify images inside `static/images` that have no references to them in the tree of markdown files. Used to clean out old and crufty content from posts that are now dead.
* `import.py` was used to import content from my `nikola` blog, by converting `.rst`, and reformatting front matter to hugo-flavored TOML.



### Quick Reference

New Post:

  $ hugo new post/title.md

Linking between pages:

  [link text]({{<ref "other_page.md">}})

Centering an image:

  ![alt text](/images/path/to/myfile.svg#center)
