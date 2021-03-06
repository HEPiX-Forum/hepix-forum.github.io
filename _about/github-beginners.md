---
title: GitHub for Beginners
author: Michel Jouvin
layout: page
---

# GitHub for Beginners
{:.no_toc}

##### Table of Contents:
{:.no_toc}

* auto-gen TOC:
{:toc}

This page is a GitHub and Git survival kit for people not familiar with these tools! This is not a documentation or tutorial about these tools. 
Many excellent ones are already available, including:

* [GitHub Bootcamp](https://help.github.com/categories/bootcamp/), in particular [fork a repository](https://help.github.com/articles/fork-a-repo)
* [Git for the Novice](http://swcarpentry.github.io/git-novice/) from [Software Carpentry](http://software-carpentry.org/)
* [Git Book](https://git-scm.com/book/en/v2): the definitive Git reference! Certainly not for beginners!


## GitHUb Workflow

At a first glance, GitHub (and Git) may look complex with their "workflows". But they are not so much in fact. What makes these tools great
is that they allow a clear separation between your personal work and what you decide to show or export. Your personal work, unlike with tools
like SVN, can be versionned and you can work on different things in parallel (branches) very easily.

In the hepix-forum web site context, what is shared is what is in the project repository called, [hepix-forum.github.io](https://github.com/hepix-forum/hepix-forum.github.io).
Your personal environment is made of 2 parts:

* One personal repository on GitHub, called a *fork*. It is typically created using the GitHub web interface, click on the `Fork` button when you are
in the project repository. Despite this is a Git repository, you cannot access it directly from you local computer with Git commands (for example, you
cannot `git commit` changes made on your local computer to it).
* One (or several) clone of your personal repository on GitHub. This is where you'll make/develop your changes, using the full versionning
capabilities of Git. And until you publish (`git push`) your changes to your personal repository (fork) on GitHub,
they are not visible by anybody
else. Once they have been pushed to your fork, they are potentially visible but you control when you want to submit
these changes to the project repository by creating a `pull request`: at this point people can review/comment your
changes and people with the appropriate permissions can `merge` (accept) your changes in the project repository.

With this *GitHub workflow*, the only repository you need to have write access to on GitHub is your personal repository. This ensures that
nothing wrong can happen to the project repository because you are not a Git/GitHub expert.

Sections below give more details on the main steps involved. Note that there is a help available for each
Git command that can be displayed with:

```bash
git help
git help command
```


## GitHub Account Creation and Configuration

To contribute, you definitely need to have a GitHub account: connect to [gitHub](http://github.com) and follow the instructions.

Once you have an account, it is
recommended to configure your SSK keys that will be used for the authentication: follow the GitHub
[documentation](https://help.github.com/articles/generating-ssh-keys/). Using SSH keys is not a requirement but is recommended: the
alternative if you want to contribute is to use `https` but in this case any interaction with GiHb through the `git` command may require
(depending on your OS) that you enter your password...


## Creating your Personal Environment

As explained in the introduction, this involves 2 steps:

* Creating your personal fork: with your browser, open this web site [repository](https://github.com/hepix-forum/hepix-forum.github.io) and
click on the `Fork` button at the top-right of page.
* Creating your local clone of your personal fork (assuming your name is `johndoe`):

  ```bash
  # The local Git repository will be in a directory hepix-forum.github.io in your current directory.
  # The exact URL to use is on the right side of web page, when you display your personal fork.
  git clone git@github.com:johndoe/hepix-forum.github.io.git
  # Move in your repository
  cd hepix-forum.github.io
  ```

* Connect your local clone to the project repository: as it will be explained in other sections, there are several occasions where you
will want to import changes that happened in the project repository into your local clone that you use to develop your contributions. In Git,
this involves creating a *remote* and is done with:

  ```bash
  # Later to refer to the project repository, we'll use the remote called upstream
  git remote add upstream git@github.com:hepix-forum/hepix-forum.github.io.git
  ```

Note that adding a remote adds no information to the repository itself.


## Making your Changes

This step is about making your changes in your local clone: nothing will be visible on GitHub at this stage. There are many variations of the
steps involved here: below are the main/recommanded ones.

* Get the last updates from the project repository and add them to your local clone. **This doesn't make any change** to your local developments
(branches):

  ```bash
  git fetch upstream
  ```

* Create a branch for your new contribution (existing branches can be displayed with `git branch`). Having a large
number of branches is not a problem, so avoid reusing existing branches, in particular if you are not a Git expert, as
you increase the risk of a conflict.
Here we'll start a new branch based on the last state of the main
project branch called `master`):

  ```bash
  # New branch will be called mydev1
  git checkout -b mydev1 upstream/master
  ```

* Make your changes: create new files, modify existing ones with your preferred editor. For example, we add a file
called `test`

  ```bash
  echo "Hello world" > test
  ```

* Commit your changes. Git is quite powerful to select what changes you want to make part of a commit: this allows to commit separately several
set of changes made at the same time. For this reason, there is a command `git add` than can be used before the commit itself (`git commit`) if
you want to add new files marked as `untracked` byt `git status`. To add all the modifications to the files
previously managed by Git, you can use option `-a` of `git commit` insted of executing `git add` before:

  ```bash
  # Add file `test` created before
  git add test
  # -m option can be used to set the commit message rather than being asked for, else an editor is open to enter it
  git commit
  ```

Note that you can do the cycle edit/commit as many times as you want, until you are satisfied, before pushing your changes.

## Publishing your Changes

Publishing changes involves 2 steps (again!):

* Pushing your changes to your personal fork on GitHub. This is done on your local machine with the following Git command. Note that the command is
executed twice: the first time to check that what will be done is correct, the second to actually do it: this is by no means mandatory but is a best
practice, in particular when you are not familiar with Git.

  ```bash
  # In this command origin is the Git remote pointing to your fork
  # and HEAD is a symbolic name for the current branch.
  # After the first push of your branch to GitHub, you can use 'git push' without options
  git push --set-upstream origin HEAD -n
  # Check what will be done by the command and reexecute without -n to actually do it
  git push --set-upstream origin HEAD

  ```

* Ask for your changes to be integrated into the project. This is done by creating a pull request, using the web interface: if you open either your
personal fork or the project repository after you have pushed something to a branch of your personal fork that is not yet published in an open
pull request, GitHub will display a line proposing to create a pull request. Just click the button, check the title of the pull request and add
a description.

After the pull request has been created, all the persons interested in the project repository changes will be notified by email. Everybody can
subscribe the repository [notifications](https://help.github.com/articles/about-notifications/). At this point, your contribution is open for
review: people can comment, suggest changes... When there is an agreement that the contribution is in good shape, somebody with
the appropriate permission will *merge* it in the poject repository (this is a one-click operation).

Note that as soon as a pull request is open, every change that you make to the personal branch that you published (which is the source of the
pull request) is published immediately (until the pull request is closed/merged). You cannot create several pull requests with the same source branch.

When the pull request is merged, you can decide to delete your personal branch that was used to make your contribution but there is no real
need to do it... It's a matter of personal taste!
