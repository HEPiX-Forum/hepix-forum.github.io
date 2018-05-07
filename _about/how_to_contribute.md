---
title: How to Contribute to The Web Site
layout: page
---

# How to Contribute to The Web Site
{:.no_toc}

##### Table of Contents:
{:.no_toc}
* auto-gen TOC:
{:toc}


This website is implemented using [GitHub Pages](https://pages.github.com/) service which makes it easy to create a website associated with
a GitHub account or project. GitHub Pages uses [Jekyll](https://help.github.com/articles/using-jekyll-with-pages/), a tool to automatically build 
a website from source files (which are kept in GitHub).
The site content is written using the easy [Markdown syntax](http://daringfireball.net/projects/markdown/syntax) (which is used by GitHub itself).

A [beginner's guide](/about/jekyll-beginners.html) provides some useful hints to make using Jekyll in the HEPiX context easier.
**It is recommended to read it if you are not familiar with Jekyll.**

## How to add and edit information

For adding information to this site or modifying it, we follow the *[pull request](https://help.github.com/articles/using-pull-requests/)* 
workflow in GitHub.

You **must** start by [forking](https://github.com/HEPiX-Forum/hepix-forum.github.io#fork-destination-box)
our [website repository](https://github.com/hepix-forum/hepix-forum.github.io) and then, clone **your fork**
(not the website repository) with your preferred Git client. Once you have done it, for every contribution you'd
like to make, the workflow is:

* Get the last updates from the web site repository with:

    ```bash
    git fetch --all
    ```

* Create a development branch from the web site repository (do not use the `master` branch for your contributions,
avoid reusing an existing branch if you are not familiar with Git) with:

    ```bash
    git checkout -b dev_branch upstream/master`
    ```

* Edit the files you want to add or modify
* Push them to your fork with:

    ```bash
    git push --set-upstream origin HEAD
    ```

* Open a pull request with the GitHub web interface (GitHub should propose to it when you open either the web
repository or your fork)

If you wish (and it is recommended), you can easily set up a local instance of this web site in order to preview your submissions. 
See the [documentation](https://help.github.com/articles/using-jekyll-with-pages/) on installing and running Jekyll.
The website uses the master branch of the hepix-forum.github.io repository.

**If you are not familiar with GitHub and Git, read our [survival kit](/about/github-beginners.html)!**

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
