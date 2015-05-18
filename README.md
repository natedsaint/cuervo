# Cuervo [![Build Status](https://travis-ci.org/natedsaint/cuervo.svg?branch=master)](https://travis-ci.org/natedsaint/cuervo) [![Coverage Status](https://coveralls.io/repos/natedsaint/cuervo/badge.svg?branch=master)](https://coveralls.io/r/natedsaint/cuervo?branch=master) [![Cuervo on NPM](https://img.shields.io/npm/v/cuervo.svg)](https://npmjs.org/package/cuervo) [![Dependency Status](https://gemnasium.com/natedsaint/cuervo.svg)](https://gemnasium.com/natedsaint/cuervo)

A fork of a clone! [Heckle][1] gave me the idea, which Marijn Haverbeke describes as a "minimal [Jekyll][2] clone in node.js."

[1]: https://github.com/marijnh/heckle
[2]: https://github.com/mojombo/jekyll

## Why?

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

## Setup

I'll go ahead and jump on the bandwagon and say at this point: this is NOT a stable
or finished project. It's a work in progress, and there's a good chance I'll slowly
(or rapidly) develop individual pieces as I go.


If, against your own better judgment, you're still reading this, you can start by getting  
the dependencies set up with `npm install`.

When the dependencies have been installed, you should be able to
change to the directory that contains your blog files, and run...

    nodejs /path/to/cuervo.js

I've tried to make cuervo into a package so that it can be implemented. As of now, the only
export is the generate method, which walks through the current directory and builds everything.

Along the same vein as [Jekyll][2] and [Heckle][1], it parses a `_config.yml` 
and treats `_posts`, `_layouts`, and
`_includes` dirs. Your templates should be in
[Mustache][3] syntax, but they will also be parsed using markdown.  

[3]: https://mustache.github.com

I'm doing my best to follow the best development standards I know in this project, but
I'm bound to screw things up. If you get lost, check out the source!
