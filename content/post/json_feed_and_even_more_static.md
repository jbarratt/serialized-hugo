+++
date = "2017-06-07T06:33:16-07:00"
description = "On adding JSON Feed support and making older posts truly static"
title = "JSON Feed, and an even more static blog"
+++

In the design of my site, I decided to put a small block at the bottom of each page with links to the most 5 recent posts.

Unfortunately, that choice had a bad side effect; every time I wrote a new post, it meant regenerating every single post page, and uploading them all.

This lead to an interesting chain of ideas.

1. Hm, what if I just injected that with Javascript after the page render? It's optional content anyway.
2. I guess I'd need to publish the recent pages out as a different file.
3. Oh, wait, I already do that, it's the RSS feed.
4. Yuck. Parsing RSS in Javascript is pretty heavyweight.
5. You know, [JSON Feed](https://jsonfeed.org/) is a thing now, and I should support that anyway...
6. Oh look, [this guy figured out how to do it with Hugo](https://rumproarious.com/2017/05/17/json-feed-for-hugo/).

To get it working I had to make a few changes:

`config.toml` by default won't generate JSON. This is easy to add.

```
[outputs]
  home = [ "HTML", "JSON", "RSS"]
```

I only wanted to show Posts, so instead of going over all pages in the site, I filtered them out:

```
 {{ range $index, $element := first 10 (where .Data.Pages "Section" "post") }}
```

And then added them to my [partials/head.html](https://github.com/jbarratt/serialized-hugo/blob/master/themes/serialized/layouts/partials/head.html):

```
{{ with  .OutputFormats.Get "json" -}}
<link rel="{{ .Rel }}" type="{{ .MediaType.Type }}" href="{{ .Permalink | safeURL }}">
{{ end -}}
```

And that was that, I have a JSON feed. `#futureblogging`.

To integrate it into the page, I don't want to block the render, since it's optional. I replaced the `latest-posts.html` partial I'd created with a small function to load the content builder.

```html
<script type="text/javascript">
window.addEventListener("load", function load(event){
    window.removeEventListener("load", load, false); //remove listener, no longer needed #tidy
    var element = document.createElement("script");
    element.src = "{{ "js/recent_posts.js" | absURL }}"
    document.body.appendChild(element);
},false);
</script>
```

Great! So all that's left is [recent_posts.js](https://github.com/jbarratt/serialized-hugo/blob/master/themes/serialized/static/js/recent_posts.js).

A small excerpt, which walks through the recent items and generates the HTML to be injected above the footer:

```javascript
getJSON('/index.json', function(recent) {
	var content = `
	<h3>Other Recent Posts</h3>
	<ul id="post-list" class="archive readmore">
	`
	for(var post=0; post < 5; post++) {
		var p = recent['items'][post];
		var date = formatDate(p.date_published);
		content += `
		<div class="post-item">
			<a href="${p.url}" class="post-link">
				${p.title}
			</a>
			<span class="post-time">${date}</span>
		</div>
		`
	}
	content += "</ul>"
	var footer = document.getElementById('footer');
	footer.insertAdjacentHTML('beforebegin', content);
}, function(status) {
	console.log('Unable to load recent posts JSON.');
});
```

This is my first time using [template literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals), which are [widely adoped enough now](http://caniuse.com/#search=template%20literals) for me. These are incredibly useful, I love how readable it is to fabricate HTML directly, and no need to load another Javascript library for templating. It's also a great vote of confidence for JSON Feed, I'm sure there are many many use cases where a site will want to be able to introspect it's own recent content.

And sure enough, publishing a new post now only needs to upload the index files, the new post, the archive page, and the post itself. Slick.
