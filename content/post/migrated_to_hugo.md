+++
date = "2017-06-06T00:31:35-07:00"
description = "Migrated my blog to hugo"
title = "This blog now powered by Hugo"
+++

Well, I have once more decided to switch site creation engines, this time to [Hugo](http://gohugo.io).
The source is all up in my [serialized-hugo](https://github.com/jbarratt/serialized-hugo) repository.

Up until this point, I've been using [Nikola](https://getnikola.com/), and it's still truly excellent software. However, I wanted to give my theme a refresh to something very minimal, and I really liked a lot of the ideas on Hugo's website, so I gave it a try.

I'm a fan.

* Hugo rebuilds the site incredibly quickly, which allowed me to develop my theme and import content with very low friction.
* The local livereload server worked flawlessly, and also saved a ton of time
* The documentation was top notch, I was able to find everything I needed very quickly; and in the few cases where the docs didn't cover something, the [forums](https://discuss.gohugo.io/) did.
* I love static binaries, especially for this use case. I tend to get the urge to update the site frequently for a bit, then take a breather. With previous static site builders that were based on interpreters, I'd often find that for one reason or another, when I came back to my blog after a long break, step 1 was getting the software running again. With static binaries that's very unlikely to happen.
* The software/user experience design for Hugo is very strong. Almost everything I touched *felt* "designed", in a good way. 

Here's an example of one of the well-designed features I was impressed by:

I read the source for a few other themes to see how they'd been put together, and the [cactus theme](https://github.com/digitalcraftsman/hugo-cactus-theme/) showed me a really useful pattern, one which hasn't caught up with the Hugo 'build a theme' tutorial docs yet.

Hugo has 2 nice features in the templating system which make building custom pages extremely easy.

* [Block Templates](https://gohugo.io/templates/blocks/)
* [Partial Templates](https://gohugo.io/templates/partials/)

Here is my `index.html` template for my main landing page, in it's entirety.

```
{{ define "main" }}
	{{ range first 1 (where .Site.RegularPages "Section" "!=" "") }}
		{{ partial "single-post.html" . }}
	{{ end }}
	{{ partial "latest-posts.html" . }}
{{ end }}
```

This is an amazingly small bit of code to represent the full landing page. So how does it work?

The `{{ define "main" }}` block triggers hugo to go look for the "base" template that's appropriate for the type. The docs describe the search path in some detail, but in this case, they match my [`_default/baseof.html`](https://github.com/jbarratt/serialized-hugo/blob/master/themes/serialized/layouts/_default/baseof.html). 

That file actually has the whole structure for the page, from the doctype on down. And inside it, the block template feature allows for it to define named regions:

```
<section id="wrapper">
    {{ block "main" . -}}{{- end }}
    {{ partial "footer.html" . }}
</section>
```

The `block` keyword essentially is registering a writeable space for other templates to be able to inject into if they'd like, by defining the same name. So `index.html` has a `define "main"` block, the contents of which are injected into the `baseof.html`'s `block "main"`. The `block` directive has a dot after it, which tells the template processor to also pass in the context at render time -- in this case, the post object, that has all the details about the post.


The `partial` keyword also means that common functionality can be factored out into small, reusable pieces, such as the footer above. But in the index page, there's a more interesting example:

```
{{ range first 1 (where .Site.RegularPages "Section" "!=" "") }}
    {{ partial "single-post.html" . }}
{{ end }}
```

When `index.html` is rendered, it gets an object which represents the entire site. (`.Site.`) I only want the most recent post to be rendered onto the front page, and it should look basically the same as if you'd gone to the permanent link for that page. This is easy! The `where` block on the right filters out odd pages (like `/about`), leaving only the posts. The `range first 1` then takes the first post off that list, and hands it to the `partial` to render.

Conveniently, the `single-post.html` is the same content which gets included by the regular post display page, so if I update that, the main page updates too, and vice versa.

The process of importing content to Hugo was also very nice. The integrated livereload server helps provide instant feedback, even with things like stylesheet changes. One trick I did have to figure out -- because I work on a different machine (a NUC on my lan) some of the generated links were wrong. Explicitly proving the server's name on the network did the trick.

```
$ hugo server -b "http://devserver.local./" --bind 0.0.0.0
```

Thank you to the hugo creators and community for a truly excellent tool -- that I'm very glad to have in my toolbox.:heart:
