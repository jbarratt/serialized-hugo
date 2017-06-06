#!/usr/bin/env python

""" simple script to import content from nikola

    - find all the files in the other posts tree
        posts/..../*
    - if the type is .rst, run it through pandoc
    - if the matching name already exists, log and skip
        content/post/<name>
    - parse the front matter
    - extract date, title, slug
    - transform date into YYYY-MM-DDTHH:MM:SS TZ
    - dump back out with toml fence (+++) and var = "value"
    - dump over rest of content
"""

import os
import re
import sys
import dateutil.parser as parser
import subprocess

SRCPOSTS = os.path.expanduser("~/work/serialized-nikola/posts")
DSTPOSTS = os.path.expanduser("~/work/serialized-hugo/content/post/")


def convert_date(olddate):
    """ convert a date from existing format to what hugo wants """

    date = parser.parse(olddate)
    return date.strftime("%Y-%m-%dT%H:%M:%S-07:00")


def extract_frontmatter(frontmatter):
    """ return a dict with desired frontmatter """
    data = {}
    pair_re = r'.. (title|date|slug): (.*)'
    for key, value in re.findall(pair_re, frontmatter):
        if key == "title" or key == "slug":
            data[key] = value
            continue
        data['date'] = convert_date(value)

    return data


def load_original(srcpath):
    """ returns a dict of date, title, slug, content
        or None if parse failed """
    content = open(srcpath, 'r').read()
    fmatch = re.search(r'\s*(<!--.*?-->)', content, re.DOTALL)
    if not fmatch:
        print "unable to find front matter in {}".format(srcpath)
        sys.exit(1)
    frontmatter = fmatch.group(1)
    data = extract_frontmatter(frontmatter)
    data['content'] = content.replace(frontmatter, '')
    return data


def import_rst(slugname, srcpath):
    """ import an rst file """
    newpath = os.path.join(DSTPOSTS, slugname)
    if os.path.exists(newpath):
        print "{} exists".format(newpath)
        return
    data = {}
    content = open(srcpath, 'r').read()
    data = extract_frontmatter(content)
    args = ['pandoc', '--from=rst', '--to=markdown', '--output=-']
    args.append(srcpath)
    data['content'] = subprocess.check_output(args)
    save_new(newpath, data)


def import_md(slugname, srcpath):
    """ import a markdown file """
    newpath = os.path.join(DSTPOSTS, slugname)
    if os.path.exists(newpath):
        print "{} exists".format(newpath)
        return
    data = load_original(srcpath)
    save_new(newpath, data)


def save_new(newpath, data):
    with open(newpath, 'w') as of:
        of.write("+++\n")
        for key in ("date", "title", "slug"):
            of.write("{} = \"{}\"\n".format(key, data[key]))
        of.write("+++\n")
        of.write(data['content'])


def main():
    for root, _, files in os.walk(SRCPOSTS):
        for name in files:
            if name.endswith(".rst"):
                md_name = name.replace(".rst", ".md")
                import_rst(md_name, os.path.join(root, name))
                continue
            if name.endswith(".md"):
                # print "processing {}".format(name)
                import_md(name, os.path.join(root, name))
                continue
            else:
                print "unknown extension on {}".format(os.patn.join(root, name))


if __name__ == "__main__":
    main()
