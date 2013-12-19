var fs = require("fs");
var rmrf = require("rimraf");
var yaml = require("js-yaml");
var marked = require("marked");
var Mustache = require("mustache");
var util = require("./util");
var dateformat = require("dateformat");
CodeMirror = require("codemirror/addon/runmode/runmode.node.js");

marked.setOptions({highlight: highlightCode, gfm: true});

function highlightCode(code, lang) {
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
      if (style) html += "<span class=\"cm-" + style + "\">" + util.escapeHTML(token) + "</span>";
      else html += util.escapeHTML(token);
    });
    return html;
  } else return code;
}

function hasFrontMatter(file) {
  var fd = fs.openSync(file, "r"),
      b = new Buffer(4),
      ret;
  ret = fs.readSync(fd, b, 0, 4, 0) == 4 && b.toString() == "---\n";
  fs.closeSync(fd);
  return ret;
}

function readFrontMatter(file) {
  var end,
      ret;
  if (/^---\n/.test(file)) {
    end = file.search(/\n---\n/);
    if (end != -1) {
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
}

function readPosts(config) {
  var posts = [],
      d,
      split,
      post,
      escd;
  fs.readdirSync("_posts/").forEach(function(file) {
    d = file.match(/^(\d{4})-(\d\d?)-(\d\d?)-(.+)\.(md|link|mustache|html)$/);
    if (!d) {
      return;
    }
    split = readFrontMatter(fs.readFileSync("_posts/" + file, "utf8"));
    post = split.front;
    post.rawDate = new Date(d[1]+"-"+d[2]+'-'+d[3]).getTime();
    post.date = dateformat(d[1]+"-"+d[2]+"-"+d[3],"fullDate");
    
    post.name = d[4];
    if (!post.tags) post.tags = [];
    if (!post.tags.forEach && post.tags.split) post.tags = post.tags.split(/\s+/);
    if (d[5].match(/(md)/)) {
      post.content = marked(split.main);
      post.summary = post.content.slice(0);
      post.summary = post.content.split(" ").splice(0,config.summaryWords).join(" "); 
      post.url = getURL(config, post);
      post.rssSummary = post.summary;
      if (post.summary.length < post.content.length) {
        post.summary += " <a href=\""+post.url+"\">"+config.summaryReadMoreText+"</a>";
      }
    } else if (d[5] == "link") {
      escd = util.escapeHTML(post.url);
      post.content = "<p>Read this post at <a href=\"" + escd + "\">" + escd + "</a>.</p>";
      post.isLink = true;
    } else if (d[5] == "html") {
      post.url = getURL(config,post);
      post.styleUrl = post.url.replace(/html/,"css");
      post.content = split.main;
    }
    posts.push(post);
  });
  posts.sort(function(a, b){return b.rawDate - a.rawDate;});
  return posts;
}

function gatherTags(posts) {
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
}

var defaults = {
  postLink: "${name}.html",
  makeRewrites: true,
  latestNewsCount: 5,
  makeFeed: false,
  summaryWords: 100,
  summaryReadMoreText: "... read more"
};

function readConfig() {
  var config = (util.exists("_config.yml") && yaml.load(fs.readFileSync("_config.yml", "utf8"))) || {},
      opt;
  for (opt in defaults) {
    if (defaults.hasOwnProperty(opt) && !config.hasOwnProperty(opt)) {
      config[opt] = defaults[opt];
    }
  }
  return config;
}

function getURL(config, post) {
  var link = config.postLink,
      prop;
  for (prop in post) {
    if(post.hasOwnProperty(prop)) {
      link = link.replace("${" + prop + "}", post[prop]);
    }
  }
  return link;
}

function ensureDirectories(path) {
  var parts = path.split("/"), 
      cur = "",
      i;

  for (i = 0; i < parts.length - 1; ++i) {
    cur += parts[i] + "/";
    if (!util.exists(cur, true)) {
      fs.mkdirSync(cur);
    }
  }
}

function prepareIncludes(ctx) {
  if (!util.exists("_includes/", true)) {
    return;
  }
  var partials = {};
  fs.readdirSync("_includes/").forEach(function(file) {
    partials[file.match(/^(.*?)\.[^\.]+$/)[1]] = fs.readFileSync("_includes/"+file,"utf8"); 
  });
  return partials;
}

var layouts = {};

function getLayout(name, ctx) {
  if (name.indexOf(".") == -1) {
    name = name + ".mustache";
  }
  if (layouts.hasOwnProperty(name)) {
    return layouts[name];
  }
  var tmpl = fs.readFileSync("_layouts/" + name, "utf8");
  layouts[name] = tmpl;
  return tmpl;
}

function generateRSS(posts,config) {
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
}

function generate() {
  var config = readConfig(), 
      posts = readPosts(config),
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
      tags: gatherTags(posts), 
      config: config
    },
    partials: prepareIncludes()
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
    post.firstPost = posts[posts.length-1].url;
    post.lastPost = posts[0].url;
    post.nextPost = (typeof posts[idx-1] !== "undefined") ? posts[idx-1].url : null;
    post.prevPost = (typeof posts[idx+1] !== "undefined") ? posts[idx+1].url : null;
    post.isFirst = (idx === posts.length-1);
    post.isLast = (idx === 0);
    var path = "_site/" + post.url,
        postContent;
    ensureDirectories(path);
    postContent = Mustache.render(getLayout(post.layout || "post.mustache",ctx),post,ctx.partials);
    fs.writeFileSync(path, postContent, "utf8");
  });
  if(config.makeFeed) {
    var feedPath="_site/feed.rss";
    rssFeed = generateRSS(posts,config);
    ensureDirectories(feedPath);
    fs.writeFileSync(feedPath,rssFeed, "utf8");
  }
  function walkDir(dir) {
    fs.readdirSync(dir).forEach(function(fname) {
      if (/^[_\.]/.test(fname)) {
        return;
      }
      var file = dir + fname;
      if (fs.statSync(file).isDirectory()) { // found directory, recursively crawl it!
        walkDir(file + "/");
      } else {
        var out = "_site/" + file;
        ensureDirectories(out); // make sure the directory structure is already set for this

        if (/\.(md|mustache|html)$/.test(fname) && hasFrontMatter(file)) {
          var split = readFrontMatter(fs.readFileSync(file, "utf8")),
              doc = split.front,
              layout = getLayout(doc.layout || "page.mustache", ctx);
          doc.content = split.main;
          if (/\.(md)$/.test(fname)) {
            doc.content = marked(doc.content); // parse markdown but only if (md) file
          }
          doc.name = fname.match(/^(.*?)\.[^\.]+$/)[1];
          doc.url = file;
          doc.posts = posts;
          out = out.replace(/\.(md|mustache)$/,".html"); // output will always be html to be parseable by browser
          for (var i in doc) {
            ctx.site[i] = doc[i];
          }
          doc.content = Mustache.render(doc.content,ctx.site,ctx.partials); // allow you to use mustache inside your page content : view object is ctx.site
          doc.summary = doc.content.slice(0);
          doc.summary = doc.summary.split(" ").splice(0,config.summaryWords).join(" "); 
          pageContent = Mustache.render(layout,doc,ctx.partials);
          fs.writeFileSync(out, pageContent, "utf8");
          var noExtension = fname.replace(/\.(md|mustache)$/,'');
          accessfile += "RewriteRule ^"+noExtension+"$ "+fname.replace(/\.(md|mustache)$/,".html")+"\n";
        } else { // was not markdown or mustache, we'll just move it
          util.copyFileSync(file, out);
        }
      }
      if(config.makeRewrites) {
        fs.writeFileSync("_site/.htaccess",accessfile,"utf8");
      }
    });
  }
  var accessfile = "RewriteEngine On \n";
  walkDir("./"); 
}

exports.generate = generate;
