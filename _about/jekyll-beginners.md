---
title: Jekyll Introduction
author: Michel Jouvin
layout: page
---

# Jekyll Introduction
{:.no_toc}

##### Table of Contents:
{:.no_toc}
* auto-gen TOC:
{:toc}

This web site is hosted by [GitHub Pages](https://pages.github.com) which relies on a framework called 
[Jekyll](https://jekyllrb.com). This page documents a few useful hints that help contributing to the web site 
and assessing the result of your contributions. Refer to the linked documentations for details about [
GitHub Pages](https://pages.github.com) and [Jekyll](https://jekyllrb.com).



## Content Format

Jekyll expect the web site contents to be written in [Markdown](https://guides.github.com/features/mastering-markdown/) with 
a special section at the beginning of the file called `frontmatter`. This section contains attribute definitions used to render the file. It is delimited by a pair of `---` lines. A typical frontmatter section is:

```
---
title: Contributing to the HSF Web Site
author: Michel Jouvin
layout: default
---
```

After the frontmatter section, you have to write in markdown (or generate markdown from another format, see below).


### File Name Format

Files can be either associated to a subtopic, in a directory generally beginning by a `_`: in this case the file name has no specific format. Just its
extension must be `.md`.

There is one exception: this is files stored in the `_posts` directory. These files are blog-like entries and 
Jekyll expects the file names 
in these `_post` directories to follow the following convention:

```
YYY-MM-DD-some-text.md
```

with:

* `YYYY`: the year
* `MM`: the month number
* `DD`: the day number


### Adding a TOC

To generate a table of contents of the file, you need to add the following lines where you want to insert it:

```
* auto-gen TOC:
{:toc}
```

If you don't want a heading, for example the page title (heading level 1), to be inserted into the TOC, you need to insert the following line right after the heading:

```
{:.no_toc}
```

Look at the source of this page for an example.


### Inserting images

To insert an image, add it (as a PNG or JPEG file) to the `images` directory. Thenn in the page where you want to insert
it, add the following line:

```
![Replacement text](/images/file){:height="400px" width="600px" .centered-image}
```

where:

* `Replacement text` is the text displayed when the cursor is on the image and the image cannot be displayed.
* `/images/file` is the path to the image file, relative to the top directory of the web site. Images are typically in
`/images` directory.
* `{...}` are optional rendering instructions, using CSS attributes. `height` and `width` are used to define the size of the
rendered image (whatever is its orignal size), `px` meaning the unit is pixel. `.centered-image` is a CSS class that
allows to center horizontally the image (everything starting with a `.` is interpreted as a CSS class, typically defined
into `css/hsf.css`).

## Checking the Results of Your Contribution

It is often desirable to assess the result of changes before publishing them. There is no services at GitHub to do that: 
you can only render the markdown contents, without all the CSS and other things. To achieve this, you need to install 
Jekyll on your local machine. Detailed instructions can be found on Jekyll [web site](https://jekyllrb.com/docs/installation/) 
but the short story is:

* Install [Ruby](https://www.ruby-lang.org/en/downloads/) and [RubyGems](https://rubygems.org/pages/download)
* Install Bundler (a Ruby package manager):

  ```bash
  gem install bundler
  ```

* If you don't have one yet, create a clone of this web site repository and move to the directory created (by default `hepix-forum.githb.io`):

  ```bash
  git clone https://github.com/hepix-forum/hepix-forum.github.io.git
  cd hepix-forum.github.io
  ```

* Install/update your Jekyll installation (must be done regularly):

  ```bash
  bundler update
  ```

* Run Jekyll installation:

  ```bash
  bundler exec jekyll serve
  ```


Once Jekyll has been started you can view the web site by connecting to `localhost:4000`.

