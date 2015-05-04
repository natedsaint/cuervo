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
    prepareIncludes : function(ctx) {
        if (!util.exists("_includes/", true)) {
            return;
        }
        var partials = {};
        fs.readdirSync("_includes/").forEach(function(file) {
            partials[file.match(/^(.*?)\.[^\.]+$/)[1]] = fs.readFileSync("_includes/"+file,"utf8");
        });
        return partials;
    },
    getLayout : function(name, ctx) {
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
    generate : function() {
        var me = this,
            config = me.readConfig(),
            posts = me.readPosts(config),
            categorizedPosts = me.categorizePosts(posts),
            latestPosts = posts.slice(0),
            ctx,
            partials,
            rssFeed;
        
        ctx = {
            site: {
                posts: posts,
                latestPosts: latestPosts.splice(0,config.latestNewsCount),
                lastPost: posts[0].url,
                firstPost: posts[posts.length-1].url,
                prevPost: (posts[1]) ? posts[1].url : '',
                tags: me.gatherTags(posts),
                config: config
            },
            partials: me.prepareIncludes()
        };

        if (util.exists("_site", true)) {
            rmrf.sync("_site");
        }

        posts.forEach(function(post,idx) {
            if (post.isLink) {
                return;
            }
            // metadata about the post/other posts
            post.posts = posts;
            post.categorizedPosts = categorizedPosts;
            post.firstPost = posts[posts.length-1].url;
            post.lastPost = posts[0].url;
            post.nextPost = (typeof posts[idx-1] !== "undefined") ? posts[idx-1].url : null;
            post.prevPost = (typeof posts[idx+1] !== "undefined") ? posts[idx+1].url : null;
            post.isFirst = (idx === posts.length-1);
            post.isLast = (idx === 0);
            var path = "_site/" + post.url,
                postContent;
            me.ensureDirectories(path);
            postContent = Mustache.render(me.getLayout(post.layout || "post.mustache",ctx),post,ctx.partials);
            fs.writeFileSync(path, postContent, "utf8");
        });

        if(config.makeFeed) {
            var feedPath="_site/feed.rss";
            rssFeed = me.generateRSS(posts,config);
            me.ensureDirectories(feedPath);
            fs.writeFileSync(feedPath,rssFeed, "utf8");
        }
        
        me.walkDir("./",posts,categorizedPosts,ctx,config);
    },
    walkDir : function(dir,posts,categorizedPosts,ctx,config) {
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
                        layout = me.getLayout(doc.layout || "page.mustache", ctx);

                    doc.content = split.main;
                    if (/\.(md)$/.test(fname)) {
                        doc.content = marked(doc.content); // parse markdown but only if (md) file
                    }
                    doc.name = fname.match(/^(.*?)\.[^\.]+$/)[1];
                    doc.url = file;
                    doc.posts = posts;
                    doc.categorizedPosts = categorizedPosts;
                    out = out.replace(/\.(md|mustache)$/,".html"); // output will always be html to be parseable by browser
                    for (var i in doc) {
                        if (doc.hasOwnProperty(i)) {
                            ctx.site[i] = doc[i];
                        }
                    }
                    doc.content = Mustache.render(doc.content,ctx.site,ctx.partials); // allow you to use mustache inside your page content : view object is ctx.site
                    doc.summary = doc.content.slice(0);
                    doc.summary = doc.summary.split(" ").splice(0,config.summaryWords).join(" ");
                    pageContent = Mustache.render(layout,doc,ctx.partials);
                    fs.writeFileSync(out, pageContent, "utf8");
                    var noExtension = fname.replace(/\.(md|mustache)$/,'');
                    me.accessfile += "RewriteRule ^"+noExtension+"$ "+fname.replace(/\.(md|mustache)$/,".html")+"\n";
                } else { // was not markdown or mustache, we'll just move it
                    util.copyFileSync(file, out);
                }
            }
            if(config.makeRewrites) {
                fs.writeFileSync("_site/.htaccess",me.accessfile,"utf8");
            }
        });
    }
};

// to pull into node namespace if included
if (typeof module !== "undefined" && module.exports !== undefined) {
    module.exports = Cuervo;
}
