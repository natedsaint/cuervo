var Cuervo = require("../lib/cuervo.js"),
    args = {
        p : 'spec/'
    },
    app = new Cuervo(args);

describe("cuervo", function() {
    it("exists", function() {
        expect(Cuervo).toBeTruthy();
    });
    it("can be instantiated", function() {
        expect(app).toBeTruthy();
        expect(app instanceof Cuervo).toBe(true);
    });
    
    describe("app.defaults", function() {
        it("exists", function() {
            expect(typeof app.defaults).toBe("object");
        });
    });
});
