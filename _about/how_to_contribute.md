---
title: How to Contribute to The Web Site
layout: page
---

# How to Contribute to The Web Site

This website is implemented using [GitHub Pages](https://pages.github.com/) service which makes it easy to create a website associated with
a GitHub account or project. GitHub Pages uses [Jekyll](https://help.github.com/articles/using-jekyll-with-pages/), a tool to automatically build 
a website from source files (which are kept in GitHub).
The site content is written using the easy [Markdown syntax](http://daringfireball.net/projects/markdown/syntax) (which is used by GitHub itself).

A [beginner's guide](/about/jekyll-beginners.html) provides some useful hints to make using Jekyll in the HEPiX context easier.

## How to add and edit information

For adding information to this site or modifying it, we follow the *[pull request](https://help.github.com/articles/using-pull-requests/)* 
workflow in GitHub.

Just fork our [website repository](https://github.com/hepix-forum/hepix-forum.github.io) and clone your fork, edit the
files you want to add or modify, push them to your fork, and open a pull request.

If you wish (and it is recommended), you can easily set up a local instance of this web site in order to preview your submissions. 
See the [documentation](https://help.github.com/articles/using-jekyll-with-pages/) on installing and running Jekyll.
The website uses the master branch of the hepix-forum.github.io repository.

If you are not familiar with GitHub and Git, you can read our [survival kit](/about/github-beginners.html)!

### General structure of website content files

All Markdown files of this site start with a section surrounded by `---`. This
so-called *front-matter* section contains metadata about the content. Such metadata are
e.g. the author of the document or the title of the document.

In the *front-matter* (but not in the text itself), you need to replace any `&` characters (which has a special meaning in HTML) by `&amp;`.
This is particularly important for the `title` attribute.

### Adding a working group

To add a working group in the main menu and to allow to add pages attached to this working group, it is necessary to:

* Create a file at the top level, whose name represents the working group name, e.g. `mywg`, and with the extension `.md`. 
Look at `benchmarking.md` for an example.
* In the *front-matter*  section of this file, add the attribute `menu` whose value will be the menu name in the page main menu.
* Create a directory `_mywg` (if the group name is `mywg`) to contain additional pages for the working group

## Useful references

- [Jekyll](http://jekyllrb.com/) to build websites from plain text
- The [Liquid](https://github.com/Shopify/liquid/wiki) template engine used by Jekyll
- [Markdown](http://daringfireball.net/projects/markdown/syntax) syntax
