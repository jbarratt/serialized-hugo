+++
date = "2013-03-26T22:04:07-07:00"
title = "Moving from Octopress to Nikola"
slug = "moving-from-octopress-to-nikola"
+++
> **note**
>
> *Updated* 2014-06-09 If you are looking for the Octopress to Nikola
> migration script, [Mike McCracken](https://twitter.com/mikemccracken)
> has improved it and moved it to it's [own
> repository](https://github.com/mikemccracken/nikola-octopress-import).
>
> *Updated* 2013-04-17 to reflect new nikola capabilities like
> PRETTY\_URLS=True

As I mention in the [About](/about/) page, I've moved blog engines quite
a few times. Probably too many times. So I've learned from experience
not to say that this time it's for good -- but so far, I'm loving
[Nikola.](http://getnikola.com/)

Why leave Octopress?
====================

-   It's Ruby. I have no beef with Ruby at all, but I've also not spent
    the time with it that I have with several other languages. More
    often than not, when I wanted to blog, I ended up troubleshooting
    something first -- which is always fun in a toolchain you're a
    dabbler at.
-   I was ready for a visual change anyway. "Yet Another Octopress Blog"
    is a thing. (Of course, I'm worryingly close to "Yet Another
    Bootstrap Blog" now, but I'll take that.)
-   I've been writing a lot of Restructured Text recently. While I love
    Markdown, RST can do things without resorting to HTML that I've
    wanted quite frequently.

Migrating
=========

Thankfully, Nikola and Octopress are pretty similar. They both take
directories full of Markdown and convert them to a blog.

My entire blog (including this post -- we're really down the rabbit hole
now, Alice) is [on
Github](https://github.com/jbarratt/serialized-nikola), so you can see
how all of it works and is configured for yourself.

Importing the Posts
-------------------

The biggest issues are that, with markdown:

-   Octopress uses the file name and YAML front matter for metadata.
    (Title, Date, etc.)
-   Nikola uses RST-style `.. key: value` front matter, wrapped in an
    HTML comment.
-   Octopress supports a number of non-standard, non-Markdown
    extensions, like:

        { % img /images/nope.jpg 200 200 This is not Markdown, guys. % }

-   Nikola, by default, likes posts to look like
    `/posts/my-article-name.html`, whereas Octopress defaults to
    `/2008/05/my-delightful-writing/`

I wrote a script (see note above to get Mike McCrackens improved version
of it) which can be used to handle most of these changes automatically:

    $ ./import_octopress_posts.py ~/work/octopress/source/_posts ~/work/nikola/posts

Octopress is very configurable, and I only handled the special cases of
the Octopress extensions that I was actually using, so you may need to
tweak the script for your needs. It will create a directory tree like:

    posts/
        2013/
            01/
                my-post-title.md
                other-post-title.md

It only copies over posts; I only had one page, so I moved it by hand. I
also just copied over my `images/` tree, no tweaks required.

Configuring Nikola
------------------

My configuration is [in the
repo](https://github.com/jbarratt/serialized-nikola/blob/master/conf.py).
The notable configurations to make things Octopress-like are:

    # if a link ends in /something/index.html, make it just /something/
    # this, with the directory tree above,
    # makes posts look like they did in octopress
    STRIP_INDEXES = True

    # Instead of deploying files to /slug.html, make them slug/index.html
    PRETTY_URLS = True

    # The empty quotes in the center mean that all pages and posts
    # get copied into the site's '/', which is how Octopress defaults.
    # So a post at /posts/2013/01/my-post/index.md => /2013/01/my-post/index.html
    post_pages = (
        ("posts/*.md", "", "post.tmpl", True),
        ("stories/*.md", "", "story.tmpl", False),
        ("stories/*.html", "", "story.tmpl", False),
    )

Also, my Octopress was making an Atom feed, and Nikola makes an RSS one,
so I had to set up a [.htaccess
redirect.](https://github.com/jbarratt/serialized-nikola/blob/master/files/.htaccess):

    RewriteEngine On
    RewriteRule ^atom.xml http://serialized.net/rss.xml [R=301]

And that was just about it!

Remaining Issues
----------------

1.  When you run `$ nikola new_post` it doesn't know about
    the YYYY/MM/... post structure, so I've been just creating my posts
    by hand and loading in the metadata with an
    [UltiSnips](https://launchpad.net/ultisnips)
    [snippet](https://github.com/jbarratt/dotfiles/commit/de74e8f5b5d340e6a9b64fac07f84e6898410ea7).
    While I could make a new Nikola plugin to do this, I'm considering a
    patch which makes the `YYYY/MM/name-of-post.rst`
    structure unnecessary.
2.  For some reason intermediate directories (like the `2003` part of
    `2003/03/my-post/index.rst` are showing up in the sitemap, even
    though they throw 403 errors.

Neither of these were showstoppers, but it would be nice to get them
taken care of at some point.

Nikola has been a wonderful tool to get started using. The documentation
is good, it's easy to modify, with a very nice plugin system, the
development is very active, the mailing list is friendly, and pull
requests are welcome.
