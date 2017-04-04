var fs = require('fs'),
    path = require('path'),
    rmrf = require('rimraf'),
    yaml = require('js-yaml'),
    MarkedownIt = require('markdown-it'),
    md = new MarkedownIt({
        highlight: highlightCode,
        html: true
    }),
    Mustache = require('mustache'),
    util = require('./util'),
    dateformat = require('dateformat'),
    CodeMirror = require('codemirror/addon/runmode/runmode.node.js'),
    RSS = require('rss');

var highlightCode = function(code, lang) {
    if (!lang) {
        return code;
    }
    if (!CodeMirror.modes.hasOwnProperty(lang)) {
        try { require('codemirror/mode/' + lang + '/' + lang); }
        catch(e) { console.log(e.toString());CodeMirror.modes[lang] = false; }
    }
    if (CodeMirror.modes[lang]) {
        var html = '';
        CodeMirror.runMode(code, lang, function(token, style) {
            if (style) {
                html += '<span class=\'cm-' + style + '\'>' + util.escapeHTML(token) + '</span>';
            } else {
                html += util.escapeHTML(token);
            }
        });
        return html;
    } else {
        return code;
    }
};

class Cuervo {
  constructor(args) {
      this.postPath = (args && args.p) ? args.p + '_posts' : '_posts';
      if (!fs.existsSync(this.postPath)) {
          console.warn('No posts found! Either provide one with -p or execute from a dir with _posts in it ');
          process.exit();
      }
      this.printCuervo();
      this.defaults = {
          postLink: '${name}.html',
          makeRewrites: true,
          latestNewsCount: 5,
          makeFeed: false,
          summaryWords: 100,
          summaryReadMoreText: '... read more'
      };

      this.layouts = {};
      this.accessfile = 'RewriteEngine On \n';
  }

  hasFrontMatter(file) {
      var fd = fs.openSync(file, 'r'),
          b = new Buffer(4),
          ret;
      ret = fs.readSync(fd, b, 0, 4, 0) === 4 && b.toString() === '---\n';
      fs.closeSync(fd);
      return ret;
  }

  writeText(message) {
      process.stdout.write(message);
  }

  readFrontMatter(file) {
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
  }

  readPosts(config) {
      var me = this,
          posts = [],
          d,
          split,
          post,
          escd,
          timeStamp = new Date().getTime();

      fs.readdirSync('_posts/').forEach(function(file) {
          d = file.match(/^(\d{4})-(\d\d?)-(\d\d?)-(.+)\.(md|link|mustache|html)$/);
          if (!d) {
              return;
          }
          split = me.readFrontMatter(fs.readFileSync('_posts/' + file, 'utf8'));
          post = split.front;
          post.dateObject = new Date(d[2]+'-'+d[3]+'-'+d[1]);
          post.rawDate = post.dateObject.getTime();
          post.date = dateformat(d[1]+'-'+d[2]+'-'+d[3],'fullDate');
          // don't get posts from the future
          if (timeStamp < post.rawDate) {
              return;
          }
    // if the post is disabled, skip it
    if (post.disabled) {
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
              post.content = md.render(split.main);
              post.summary = post.content.slice(0);
              post.summary = post.content.split(' ').splice(0,config.summaryWords).join(' ');
              post.url = me.getURL(config, post);
              post.rssSummary = post.content;
              if (post.summary.length < post.content.length) {
                  post.summary += ' <a href=\''+post.url+'\'>'+config.summaryReadMoreText+'</a>';
              }
          } else if (d[5] === 'link') {
              escd = util.escapeHTML(post.url);
              post.content = '<p>Read this post at <a href=\'' + escd + '\'>' + escd + '</a>.</p>';
              post.isLink = true;
          } else if (d[5] === 'html') {
              post.url = me.getURL(config,post);
              post.styleUrl = post.url.replace(/html/,'css');
              post.content = split.main;
          }
          posts.push(post);
      });
      posts.sort(function(a, b){return b.rawDate - a.rawDate;});
      return posts;
  }

  gatherTags(posts) {
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

  readConfig() {
      var me = this,
          config = (util.exists('_config.yml') && yaml.load(fs.readFileSync('_config.yml', 'utf8'))) || {},
          opt;
      for (opt in me.defaults) {
          if (me.defaults.hasOwnProperty(opt) && !config.hasOwnProperty(opt)) {
              config[opt] = me.defaults[opt];
          }
      }
      return config;
  }

  getURL(config, post) {
      var link = config.postLink,
          prop;

      for (prop in post) {
          if(post.hasOwnProperty(prop)) {
              link = link.replace('${' + prop + '}', post[prop]);
          }
      }
      return link;
  }

  ensureDirectories(path) {
      var parts = path.split('/'),
          cur = '',
          i;

      for (i = 0; i < parts.length - 1; ++i) {
          cur += parts[i] + '/';
          if (!util.exists(cur, true)) {
              fs.mkdirSync(cur);
          }
      }
  }

  prepareIncludes() {
      if (!util.exists('_includes/', true)) {
          return;
      }
      var partials = {};
      fs.readdirSync('_includes/').forEach(function(file) {
          partials[file.match(/^(.*?)\.[^\.]+$/)[1]] = fs.readFileSync('_includes/'+file,'utf8');
      });
      return partials;
  }

  getLayout(name) {
      var me = this,
          tmpl;
      if (name.indexOf('.') === -1) {
          name = name + '.mustache';
      }
      if (me.layouts.hasOwnProperty(name)) {
          return me.layouts[name];
      }
      tmpl = fs.readFileSync('_layouts/' + name, 'utf8');
      me.layouts[name] = tmpl;
      return tmpl;
  }

  generateRSS(posts,config) {
      var siteDomain = config.domain || '',
          siteDescription = config.description || '',
          siteName = config.sitename || '',
          feed = new RSS({
              title: siteName,
              description: siteDescription,
              feed_url: siteDomain,
              image_url: siteDomain + '/' + config.feedImage,
          });
      posts.forEach(function(post){
          feed.item({
              title: post.title,
              url: siteDomain + '/' + post.url,
              description: post.rssSummary
          });
      });
      return feed.xml();
  }

  categorizePosts(posts) {
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
  }

  prepareClassVars() {
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
  }

  writePosts() {
      var me = this;
      me.writeText('  Writing posts : ');
      me.posts.forEach(function(post,idx) {
          me.writeText('*');
          if (post.isLink) {
              return;
          }
          /* just pull in stuff from the global vars */
          post.posts = me.posts;
          post.categorizedPosts = me.categorizedPosts;
          post.firstPost = me.site.firstPost;
          post.lastPost = me.site.lastPost;

          /* these are calculated specifically for this post */
          post.nextPost = (typeof me.posts[idx-1] !== 'undefined') ? me.posts[idx-1].url : null;
          post.prevPost = (typeof me.posts[idx+1] !== 'undefined') ? me.posts[idx+1].url : null;
          post.isFirst = (idx === me.posts.length-1);
          post.isLast = (idx === 0);

          var path = '_site/' + post.url,
              postContent;
          me.ensureDirectories(path);
          postContent = Mustache.render(me.getLayout(post.layout || 'post.mustache'),post,me.partials);
          try {
            fs.writeFileSync(path, postContent, {encoding:'utf8'});
          } catch (e) {
            console.log('error caught while writing file',e);
          }
      });
      me.writeText('\n');
  }

  generate() {
      var me = this,
          rssFeed;
      me.startTime = Date.now();
      /* pull all the relevant info into memory */
      me.prepareClassVars();

      /* if there's a site dir, kill it first */
      if (util.exists('_site', true)) {
          rmrf.sync('_site');
      }

      /* posts are all going in a single dir, just do them in order */
      me.writePosts();

      /* before we recurse through the site files, build an rss feed */
      if(me.config.makeFeed) {
          var feedPath='_site/feed.rss';
          rssFeed = me.generateRSS(me.posts,me.config);
          me.ensureDirectories(feedPath);
          fs.writeFileSync(feedPath,rssFeed, {encoding:'utf8'});
      }

      /* now we recurse through the pages of the site and build it out */
      me.writeText('  Building out site pages : ');
      me.walkDir('./');
      me.writeText('\n');
      me.printDone();
  }

  walkDir(dir) {
      var me = this;
      fs.readdirSync(dir).forEach(function(fname) {
          if (/^[_\.]/.test(fname)) {
              return;
          }
          var file = dir + fname;
          if (fs.statSync(file).isDirectory()) { // found directory, recursively crawl it!
              me.walkDir(file + '/');
          } else {
              var out = '_site/' + file,
                  pageContent;
              // make sure the directory structure is already set for this
              me.ensureDirectories(out);
              if (/\.(md|mustache|html)$/.test(fname) && me.hasFrontMatter(file)) {
                  me.writeText('.');
                  var split = me.readFrontMatter(fs.readFileSync(file, 'utf8')),
                      doc = split.front,
                      layout = me.getLayout(doc.layout || 'page.mustache'),
                      variable;

                  doc.content = split.main;
                  if (/\.(md)$/.test(fname)) {
                      // parse markdown but only if markdown (md) file
                      doc.content = md.render(doc.content);
                  }
                  doc.name = fname.match(/^(.*?)\.[^\.]+$/)[1];
                  doc.url = file;
                  doc.posts = me.posts;
                  doc.categorizedPosts = me.categorizedPosts;
                  // output will always be html to be parseable by browser
                  out = out.replace(/\.(md|mustache)$/,'.html');
                  // for each item in the front matter, make it available to the mustache model
                  for (variable in doc) {
                      if (doc.hasOwnProperty(variable)) {
                          me.site[variable] = doc[variable];
                      }
                  }
                  doc.content = Mustache.render(doc.content,me.site,me.partials);
                  doc.summary = doc.content.slice(0);
                  doc.summary = doc.summary.split(' ').splice(0,me.config.summaryWords).join(' ');
                  pageContent = Mustache.render(layout,doc,me.partials);
                  fs.writeFileSync(out, pageContent, 'utf8');
                  var noExtension = fname.replace(/\.(md|mustache)$/,'');
                  me.accessfile += 'RewriteRule ^'+noExtension+'$ '+fname.replace(/\.(md|mustache)$/,'.html')+'\n';
              } else { // was not markdown or mustache, we'll just move it
                  util.copyFileSync(file, out);
              }
          }

          if(me.config.makeRewrites) {
              fs.writeFileSync('_site/.htaccess',me.accessfile,'utf8');
          }
      });
  }

  printCuervo() {
      console.log('              -==Thanks for using==-');
      console.log(fs.readFileSync(path.resolve(__dirname, 'logo.txt'), 'utf8'));
  }

  printDone() {
      var me = this,
          newTime = Date.now(),
          diff = newTime-me.startTime;
      console.log('         -==Site published! (in ' + diff + ' ms)==-');
  }
}

Cuervo.prototype = {

};

// to pull into node namespace if included
if (typeof module !== 'undefined' && module.exports !== undefined) {
    module.exports = Cuervo;
}
