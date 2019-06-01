#!/usr/bin/env python3

"""
Quick script to
- find all the markdown files in a directory
- identify all the years in the YAML front matter
- create directories for those years if they don't exist
- `git mv` the files into those directories
"""

from os import listdir
from os.path import isfile, join, isdir
import os
import subprocess
import re
import toml
import yaml

def extract_year(path):
    with open(path, 'r') as post:
        content = post.read()
    s = re.search(r'\+\+\+\n(.+?)\+\+\+\n', content, re.DOTALL)
    if s:
        return toml_year(s.group(1))

    s = re.search(r'---\n(.+?)---\n', content, re.DOTALL)
    if s:
        return yaml_year(s.group(1))

    print("neither regex matched for %s" % path)

def toml_year(frontmatter):
    parsed_toml = toml.loads(frontmatter)
    if 'date' in parsed_toml:
        return parsed_toml['date'][0:4]
    return None

def yaml_year(frontmatter):
    parsed_yaml = {}
    try:
        parsed_yaml = yaml.load(frontmatter)
    except:
        print(frontmatter)
    if 'date' in parsed_yaml:
        return str(parsed_yaml['date'].year)
    return None


def main():
    files = [f for f in listdir(".") if isfile(join(".", f))]

    years = {}
    content = ""

    for path in files:
        year = extract_year(path)
        if year is not None:
            if year not in years:
                years[year] = []
            years[year].append(path)
        else:
            print("Couldn't find year for %s" % path)

    for year in years:
        if not isdir(year):
            print("creating %s" % year)
            os.mkdir(year)

        for name in years[year]:
            subprocess.call(['git', 'mv', name, f"{year}/{name}"])



if __name__ == '__main__':
    main()

