#!/usr/bin/env python3

""" 
Attempt to bulk update image hyperlinks

* Find every markdown file in the tree and read it into memory
* take ![](link#class) where alt and class are all optional
* replace those with 
    {{< img src="link" class="class" alt="alt">}}
* write the file back out

"""

import os
import re
import sys
import string


POSTS = os.path.expanduser("~/work/serialized-hugo/content/post/")

img_pat = re.compile(r'\!\[(.*?)\]\(([^#\)]+)#?(.*?)\)')

def img_to_shortcode(path):
    content = open(path, 'r').read()
    for m in re.finditer(img_pat, content):
        initial = m.group(0)
        (alt, href, style) = m.groups()
        hrefparts = href.split(" ", 1)
        extra = ""
        if len(hrefparts) > 1:
            href = hrefparts[0]
            extra = hrefparts[1]
        if len(extra) > 0:
            alt = extra.strip('"')
        if len(alt.strip()) > 0:
            alt = f' alt="{alt}" '
        if len(style.strip()) > 0:
            style = f' class="{style}" '

        sc = string.Template('{{< img src="$link" $alt $style >}}').substitute(link=href, alt=alt, style=style)

        print(f"old: {initial}\nnew:{sc}\n") 
        content = content.replace(initial, sc)

    with open(path, 'w') as of:
        of.write(content)


def main():
    for root, _, files in os.walk(POSTS):
        for name in files:
            if name.endswith(".md"):
                print(f"processing {name}")
                img_to_shortcode(os.path.join(root, name))
                continue


if __name__ == "__main__":
    main()
