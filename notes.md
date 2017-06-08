
Topics:

- https://github.com/KLab/myprofiler
- velvet rope
- targeted invalidations based on s3deploy output



To get the dev server running

	hugo server --verbose --bind 0.0.0.0

Which starts on localhost:1313 by default

Making a new post:

	hugo new firstpost
	hugo new secondpost

Inspirational themes:
https://github.com/halogenica/beautifulhugo
https://github.com/digitalcraftsman/hugo-cactus-theme/
https://github.com/belen-albeza/breathe-theme
https://cdnjs.cloudflare.com/ajax/libs/mini.css/2.2.0/mini-nord.min.css

### Go templates:

	{{ everything inside double curlies }}

lets you access go variables and functions.
Parameters are separated by whitespace:

	{{ add 1 2 }}

Dot notation accesses variables that should be set.
Parens group things.

	{{ if or (isset .Params "alt") (isset .Params "caption") }} Caption {{ end }}

When rendering a page, the renderer has access to a buttload of handy variables:
http://gohugo.io/templates/variables/

	.Content (page content)
	.Data (extra data from the data store)
	.LinkTitle: what to use when linking to the content
	.Pages: a collection of pages, if needed
	.Permalink
	.ReadingTime (in minutes)

... and so on.

Variables can also be set, using standard go style:

	{{ $address := "123 Main St."}}
	{{ $address }}

There are many built in functions: http://gohugo.io/templates/functions/

	default: provide a default if a variable is unset

Some work with pipe style: 

	{{ dict "title" .Title "content" .Plain | jsonify }}

Date formatting: 

	{{ dateFormat "Monday, Jan 2, 2006" "2015-01-21" }} → “Wednesday, Jan 21, 2015”



The way layouts work:

	layouts/_default/baseof.html
		this is the main outer wrapper
		it's invoked because real main pages have a define section which indicate they need a base.

Templates can also do an "include" via "partial":

	{{ partial "nav.html" . }}

And they can name blocks:

	{{ block "profile" . }}{{ end }}

This leaves a 'hook' for a later bit of code to define.

	{{ define "profile" }}
		{{ partial "profile.html" . }}
	{{ end }}

To make old links work:

	+++
			...
	aliases = [
		"/posts/my-original-url/",
		"/2010/01/01/even-earlier-url.html"
	]
			...
	+++

I may not have to do that because of the global permalinks setting, though.

For analytics:

	set googleAnalytics in the config file
	Ensure {{ template "_internal/google_analytics_async.html" . }} is set in the main template


Shortcodes:

	{{% name parameters %}}
	{{< highlight go >}} A bunch of code here {{< /highlight >}}

If you use the `<`, that shortcode makes pure HTML.
If you use %'s, that's going to generate stuff that will be processed by the processor (typically markdown)

	{{< tweet 666616452582129664 >}}
	{{< youtube w7Ft2ymGmfc >}}
	{{< gist spf13 7896402 >}}
	{{< instagram BMokmydjG-M >}}

Shortcodes are easy to create, they are partial templates, essentially

	http://gohugo.io/extras/shortcodes/
