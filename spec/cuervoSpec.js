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

    it("calls printCuervo on instantiation", function() {
        var newApp;
        spyOn(Cuervo.prototype,'printCuervo');
        newApp = new Cuervo(args);
        expect(Cuervo.prototype.printCuervo).toHaveBeenCalled();
        expect(newApp instanceof Cuervo).toBe(true);
    });

    describe("cuervo.defaults", function() {
        it("exists", function() {
            expect(typeof app.defaults).toBe("object");
        });
    });

    describe("cuervo.writeText", function() {
        it("exists", function() {
            expect(typeof app.writeText).toBe("function");
        });
        it("calls the process stdout method", function() {
            var TEST_TEXT = "test";
            spyOn(process.stdout,"write");
            app.writeText(TEST_TEXT);
            expect(process.stdout.write).toHaveBeenCalledWith(TEST_TEXT);
        });
    });

    describe("cuervo.readFrontMatter", function() {
        it("exists", function() {
            expect(typeof app.readFrontMatter).toBe("function");
        });
    });

});
