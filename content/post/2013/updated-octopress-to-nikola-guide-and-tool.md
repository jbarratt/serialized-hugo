+++
date = "2013-04-17T17:17:57-07:00"
title = "Updated Octopress to Nikola guide and tool"
slug = "updated-octopress-to-nikola-guide-and-tool"
+++
> **note**
>
> If you are looking for the Octopress to Nikola migration script, [Mike
> McCracken](https://twitter.com/mikemccracken) has improved it and
> moved it to it's [own
> repository](https://github.com/mikemccracken/nikola-octopress-import).

I updated [my guide](/2013/03/moving-from-octopress-to-nikola) to
migrating from Octopress to Nikola to reflect a new feature I submitted
to Nikola, which is available in the latest release.

Given a file on the disk like `posts/coolstory.rst`

                `PRETTY_URLS=False`         `PRETTY_URLS=True`
  ------------- --------------------------- ------------------------------
  Output File   `output/coolstory.html`     `output/coolstory/index.html`
  Ultimate URL  `http://../coolstory.html`  `http://../coolstory/`

The Octopress importer I describe in the (updated) previous post now
leverages this capability, so instead of files like
`posts/coolstory/index.rst` you can have `posts/coolstory.rst`, which
leads to a much nicer filesystem.

I also wrote a [quick
script](https://github.com/jbarratt/serialized-nikola/blob/master/util/pretty_url_cleanup.py)
to upgrade an existing Nikola site which was previously migrated from
Octopress:

    ~/nikola-site $ util/pretty_url_cleanup.py posts/
