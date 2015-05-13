"use strict";
var fs = require("fs"),
    rmrf = require("rimraf"),
    yaml = require("js-yaml"),
    marked = require("marked"),
    Mustache = require("mustache"),
    util = require("./util"),
    dateformat = require("dateformat"),
    CodeMirror = require("codemirror/addon/runmode/runmode.node.js");

var highlightCode = function(code, lang) {
    if (!lang) {
        return code;
    }
    if (!CodeMirror.modes.hasOwnProperty(lang)) {
        try { require("codemirror/mode/" + lang + "/" + lang); }
        catch(e) { console.log(e.toString());CodeMirror.modes[lang] = false; }
    }
    if (CodeMirror.modes[lang]) {
        var html = "";
        CodeMirror.runMode(code, lang, function(token, style) {
            if (style) {
                html += "<span class=\"cm-" + style + "\">" + util.escapeHTML(token) + "</span>";
            } else {
                html += util.escapeHTML(token);
            }
        });
        return html;
    } else {
        return code;
    }
};

marked.setOptions({highlight: highlightCode, gfm: true});

var Cuervo = function() {
    if (!fs.existsSync("_posts")) {
        console.warn("no posts found! (looked in _posts from this directory) ");
        process.exit();
    }
};

Cuervo.prototype = {
    defaults : {
        postLink: "${name}.html",
        makeRewrites: true,
        latestNewsCount: 5,
        makeFeed: false,
        summaryWords: 100,
        summaryReadMoreText: "... read more"
    },
    layouts : {},
    accessfile : "RewriteEngine On \n",
    hasFrontMatter : function(file) {
        var fd = fs.openSync(file, "r"),
            b = new Buffer(4),
            ret;
        ret = fs.readSync(fd, b, 0, 4, 0) === 4 && b.toString() === "---\n";
        fs.closeSync(fd);
        return ret;
    },
    readFrontMatter : function(file) {
        var end,
            ret;
        if (/^---\n/.test(file)) {
            end = file.search(/\n---\n/);
            if (end !== -1) {
                ret = {
                    front: yaml.load(file.slice(4, end + 1)) || {},
                    main: file.slice(end + 5)
                };
                return ret;
            }
        }
        ret = {
            front:{},
            main:file
        };
        return ret;
    },
    readPosts : function(config) {
        var me = this,
            posts = [],
            d,
            split,
            post,
            escd,
            timeStamp = new Date().getTime();

        fs.readdirSync("_posts/").forEach(function(file) {
            d = file.match(/^(\d{4})-(\d\d?)-(\d\d?)-(.+)\.(md|link|mustache|html)$/);
            if (!d) {
                return;
            }
            split = me.readFrontMatter(fs.readFileSync("_posts/" + file, "utf8"));
            post = split.front;
            post.dateObject = new Date(d[2]+"-"+d[3]+"-"+d[1]);
            post.rawDate = post.dateObject.getTime();
            post.date = dateformat(d[1]+"-"+d[2]+"-"+d[3],"fullDate");
            if (timeStamp < post.rawDate) { // don't get posts from the future
                return;
            }
            
            post.name = d[4];
            if (!post.tags) {
                post.tags = [];
            }
            if (!post.tags.forEach && post.tags.split) {
                post.tags = post.tags.split(/\s+/);
            }
            if (d[5].match(/(md)/)) {
                post.content = marked(split.main);
                post.summary = post.content.slice(0);
                post.summary = post.content.split(" ").splice(0,config.summaryWords).join(" ");
                post.url = me.getURL(config, post);
                post.rssSummary = post.content;
                if (post.summary.length < post.content.length) {
                    post.summary += " <a href=\""+post.url+"\">"+config.summaryReadMoreText+"</a>";
                }
            } else if (d[5] === "link") {
                escd = util.escapeHTML(post.url);
                post.content = "<p>Read this post at <a href=\"" + escd + "\">" + escd + "</a>.</p>";
                post.isLink = true;
            } else if (d[5] === "html") {
                post.url = me.getURL(config,post);
                post.styleUrl = post.url.replace(/html/,"css");
                post.content = split.main;
            }
            posts.push(post);
        });
        posts.sort(function(a, b){return b.rawDate - a.rawDate;});
        return posts;
    },
    gatherTags : function(posts) {
        var tags = {};
        posts.forEach(function(post) {
            if (post.tags){
                post.tags.forEach(function(tag) {
                    (tags.hasOwnProperty(tag) ? tags[tag] : (tags[tag] = [])).push(post);
                });
            } else {
                post.tags = [];
            }
        });
        return tags;
    },
    readConfig : function() {
        var me = this,
            config = (util.exists("_config.yml") && yaml.load(fs.readFileSync("_config.yml", "utf8"))) || {},
            opt;
        for (opt in me.defaults) {
            if (me.defaults.hasOwnProperty(opt) && !config.hasOwnProperty(opt)) {
                config[opt] = me.defaults[opt];
            }
        }
        return config;
    },
    getURL : function(config, post) {
        var link = config.postLink,
            prop;
        for (prop in post) {
            if(post.hasOwnProperty(prop)) {
                link = link.replace("${" + prop + "}", post[prop]);
            }
        }
        return link;
    },
    ensureDirectories : function(path) {
        var parts = path.split("/"),
            cur = "",
            i;

        for (i = 0; i < parts.length - 1; ++i) {
            cur += parts[i] + "/";
            if (!util.exists(cur, true)) {
                fs.mkdirSync(cur);
            }
        }
    },
    prepareIncludes : function() {
        if (!util.exists("_includes/", true)) {
            return;
        }
        var partials = {};
        fs.readdirSync("_includes/").forEach(function(file) {
            partials[file.match(/^(.*?)\.[^\.]+$/)[1]] = fs.readFileSync("_includes/"+file,"utf8");
        });
        return partials;
    },
    getLayout : function(name) {
        var me = this,
            tmpl;
        if (name.indexOf(".") === -1) {
            name = name + ".mustache";
        }
        if (me.layouts.hasOwnProperty(name)) {
            return me.layouts[name];
        }
        tmpl = fs.readFileSync("_layouts/" + name, "utf8");
        me.layouts[name] = tmpl;
        return tmpl;
    },
    generateRSS : function(posts,config) {
        // TODO: there has to be a much cleaner RSS plugin I can use
        var post,
            outputXML,
            domain,
            siteDomain = config.domain || '',
            siteDescription = config.description || '',
            siteName = config.sitename || '';
        outputXML = '<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n';
        outputXML += '<channel>\n';
        outputXML += '  <title>' + siteName + '</title>\n';
        outputXML += '  <link>' + siteDomain + '</link>\n';
        outputXML += '  <description>' + siteDescription + '</description>\n';
        if (config.feedImage) {
            outputXML += '  <image>\n';
            outputXML += '    <title>' + siteName + '</title>\n';
            outputXML += '    <link>' + siteDomain + '</link>\n';
            outputXML += '    <url>' + siteDomain + '/' + config.feedImage + '</url>\n';
            outputXML += '  </image>\n';
        }
        posts.forEach(function(post) {
            domain = config.domain || '';
            outputXML += "  <item>\n";
            outputXML += "    <title>"+post.title+"</title>\n";
            outputXML += "    <link>"+ domain + '/' + post.url+"</link>\n";
            outputXML += "    <description><![CDATA[  "+ post.rssSummary +" ]]></description>\n";
            outputXML += "  </item>\n";
        });
        outputXML += '</channel>';
        outputXML += '</rss>';
        return outputXML;
    },
    categorizePosts : function(posts) {
        var post,
            i,
            categorizedPosts = {};
        
        for (i in posts) {
            if (posts.hasOwnProperty(i)) {
                post = posts[i];
                if (post.category !== undefined) {
                    if (categorizedPosts[post.category] === undefined) {
                        categorizedPosts[post.category] = [];
                    }
                    categorizedPosts[post.category].push(post);
                }
            }
        }
        return categorizedPosts;
    },
    prepareClassVars : function() {
        var me = this;

        /* read the config yaml */
        me.config = me.readConfig();

        /* loop through and get the post data */
        me.posts = me.readPosts(me.config);

        /* for sites with categories, maintain a separate map of categorized posts */
        me.categorizedPosts = me.categorizePosts(me.posts);

        /* get the latest posts according to the config's latest news count */
        me.latestPosts = me.posts.slice(); 
        me.latestPosts = me.latestPosts.splice(0,me.config.latestNewsCount);

        /* now pull in the includes as mustache partials so they'll be available to other pages */
        me.partials = me.prepareIncludes();

        /* the posts have their own set of vars, the site pages need some, so set up a map to them here */
        me.site = {
            posts: me.posts,
            latestPosts: me.latestPosts,
            lastPost: me.posts[0].url,
            firstPost: me.posts[me.posts.length-1].url,
            prevPost: (me.posts[1]) ? me.posts[1].url : '',
            tags: me.gatherTags(me.posts),
            config: me.config
        };
    },
    writePosts: function() {
        var me = this;
        me.posts.forEach(function(post,idx) {
            if (post.isLink) {
                return;
            }
            /* just pull in stuff from the global vars */
            post.posts = me.posts;
            post.categorizedPosts = me.categorizedPosts;
            post.firstPost = me.site.firstPost;
            post.lastPost = me.site.lastPost;

            /* these are calculated specifically for this post */
            post.nextPost = (typeof me.posts[idx-1] !== "undefined") ? me.posts[idx-1].url : null;
            post.prevPost = (typeof me.posts[idx+1] !== "undefined") ? me.posts[idx+1].url : null;
            post.isFirst = (idx === me.posts.length-1);
            post.isLast = (idx === 0);
            
            var path = "_site/" + post.url,
                postContent;
            me.ensureDirectories(path);
            postContent = Mustache.render(me.getLayout(post.layout || "post.mustache"),post,me.partials);
            try {
              fs.writeFileSync(path, postContent, {encoding:"utf8"});
            } catch (e) {
              console.log("error caught while writing file",e);
            }
        });
    },
    generate : function() {
        var me = this,
            partials,
            rssFeed;

        /* pull all the relevant info into memory */
        me.prepareClassVars();
        
        /* if there's a site dir, kill it first */
        if (util.exists("_site", true)) {
            rmrf.sync("_site");
        }
        
        /* posts are all going in a single dir, just do them in order */
        me.writePosts();

        /* before we recurse through the site files, build an rss feed */
        if(me.config.makeFeed) {
            var feedPath="_site/feed.rss";
            rssFeed = me.generateRSS(me.posts,me.config);
            me.ensureDirectories(feedPath);
            fs.writeFileSync(feedPath,rssFeed, {encoding:"utf8"});
        }


        /* now we recurse through the pages of the site and build it out */
        me.walkDir("./");
    },
    walkDir : function(dir) {
        var me = this;
        fs.readdirSync(dir).forEach(function(fname) {
            if (/^[_\.]/.test(fname)) {
                return;
            }
            var file = dir + fname;
            if (fs.statSync(file).isDirectory()) { // found directory, recursively crawl it!
                me.walkDir(file + "/");
            } else {
                var out = "_site/" + file,
                    pageContent;
                me.ensureDirectories(out); // make sure the directory structure is already set for this
                if (/\.(md|mustache|html)$/.test(fname) && me.hasFrontMatter(file)) {
                    var split = me.readFrontMatter(fs.readFileSync(file, "utf8")),
                        doc = split.front,
                        layout = me.getLayout(doc.layout || "page.mustache");

                    doc.content = split.main;
                    if (/\.(md)$/.test(fname)) {
                        doc.content = marked(doc.content); // parse markdown but only if (md) file
                    }
                    doc.name = fname.match(/^(.*?)\.[^\.]+$/)[1];
                    doc.url = file;
                    doc.posts = me.posts;
                    doc.categorizedPosts = me.categorizedPosts;
                    out = out.replace(/\.(md|mustache)$/,".html"); // output will always be html to be parseable by browser
                    // I don't know what this does any more. Probably delete soon. 
                    for (var i in doc) {
                        if (doc.hasOwnProperty(i)) {
                            me.site[i] = doc[i];
                        }
                    }
                    doc.content = Mustache.render(doc.content,me.site,me.partials); // allow you to use mustache inside your page content : view object is ctx.site
                    doc.summary = doc.content.slice(0);
                    doc.summary = doc.summary.split(" ").splice(0,me.config.summaryWords).join(" ");
                    pageContent = Mustache.render(layout,doc,me.partials);
                    fs.writeFileSync(out, pageContent, "utf8");
                    var noExtension = fname.replace(/\.(md|mustache)$/,'');
                    me.accessfile += "RewriteRule ^"+noExtension+"$ "+fname.replace(/\.(md|mustache)$/,".html")+"\n";
                } else { // was not markdown or mustache, we'll just move it
                    util.copyFileSync(file, out);
                }
            }

            if(me.config.makeRewrites) {
                fs.writeFileSync("_site/.htaccess",me.accessfile,"utf8");
            }
        });
    }
};

// to pull into node namespace if included
if (typeof module !== "undefined" && module.exports !== undefined) {
    module.exports = Cuervo;
}
