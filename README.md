# Cuervo [![Build Status](https://travis-ci.org/natedsaint/cuervo.svg?branch=master)](https://travis-ci.org/natedsaint/cuervo) [![Coverage Status](https://coveralls.io/repos/natedsaint/cuervo/badge.svg?branch=master)](https://coveralls.io/r/natedsaint/cuervo?branch=master) [![Cuervo on NPM](https://img.shields.io/npm/v/cuervo.svg)](https://npmjs.org/package/cuervo) [![Dependency Status](https://gemnasium.com/natedsaint/cuervo.svg)](https://gemnasium.com/natedsaint/cuervo)

<div style="text-align:center">
  <img src="/img/cuervo_logo.png">
</div>

## Setup

I'll go ahead and jump on the bandwagon and say at this point: this is NOT a stable
or finished project. It's a work in progress, and there's a good chance I'll slowly
(or rapidly) develop individual pieces as I go.


If, against your own better judgment, you're still reading this, you can get this now by just typing

`npm install -g cuervo`

When the dependencies have been installed, you should be able to
change to the directory that contains your blog files, and run...

    cuervo

Along the same vein as [Jekyll][2] and [Heckle][1], it parses a `_config.yml` for default options, and 
treats `_posts`, `_layouts`, and `_includes` dirs. Your templates (_includes are like partials) should be in
[Mustache][3] syntax, but all your posts will also be parsed using [Markdown][4].  

Typical site format looks like this: 
- _config.yml
- contact.mustache
- styles
  - page.css
- about.mustache
- _posts
  - 2014-01-10-title.md
- _layouts
  - page.mustache
- _includes
  - header.mustache
  - footer.mustache
  - widget.md

This will result in the following in (_site) :

- feed.rss
- contact.html
- about.html
- .htaccess
- title.html
- style
  - page.css


[1]: https://github.com/marijnh/heckle
[2]: https://github.com/mojombo/jekyll
[3]: https://mustache.github.com
[4]: http://commonmark.org/

## Config options 
The configs are by default determined in the main Cuervo class:

```
defaults : {
        postLink: "${name}.html", // mustache-formatted output url
        makeRewrites: true, // makes an .htaccess file for your main pages (about.html = /about)
        latestNewsCount: 5, // for the latestNews variable, how many posts?
        makeFeed: false, // make an rss feed?
        summaryWords: 100, // how many words to determine the summary?
        summaryReadMoreText: "... read more" // when you run out of words, what does the link say?
    }
```

You you should also provide the following in your _config.yml
```
domain: http://yourdomain.com
sitename: Your Site 
description: Your blog of stuff
feedImage: images/feedLogo.png
```
## Why?

A fork of a clone! [Heckle][1] gave me the idea, which Marijn Haverbeke describes as a "minimal [Jekyll][2] clone in node.js."

Like Marijn, I liked the approach to managing a site taken by Jekyll. 

Also like Marijn, I don't like Ruby. However, unlike Marijn, I DO enjoy logic-less templates.

So the chain goes like this: 

- Jekyll is Ruby with Liquid as the templating engine.

- Heckle is JavaScript with Mold (programmable template extravaganza) as
the templating engine.

And NOW:

- Cuervo is JavaScript with Mustache as the templating engine.

## Cuervo? Are you drunk?

At the time of writing... maybe.

But cuervo is the spanish word for Crow. Follow my logic here: Jekyll was named after the mad 
scientist from Dr. Jekyll and Mr. Hyde. Heckle was transferring that logic to the magpies 
from the old Terry Toons animations. I'm following the common conception that they were the crows
from the old Dumbo cartoon, and giving them a classy Mexican mustache. It's so removed 
at this point I know you don't care, but I had to name it something.



