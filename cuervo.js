var Cuervo = require("./lib/cuervo"),
    argv = require('minimist')(process.argv.slice(2));
    site = new Cuervo(argv);

site.generate();
