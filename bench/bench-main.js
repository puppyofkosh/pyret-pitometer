{
  requires: [
    { "import-type": "dependency",
      "protocol": "js-file",
      "args": ["bench-repl"]
    }
  ],
  nativeRequires: ["q"],
  provides: {},
  theModule: function(runtime, _, uri, benchRepl, Q) {

    function timePhases(name, src) {
      var parseResultP = benchRepl.phased.parse(src, name);
      var compileResultP = parseResultP.then(function(success) {
        return benchRepl.phased.compile(success.result);
      });
      var runResultP = compileResultP.then(function(success) {
        return benchRepl.phased.execute(runtime.getField(success.result, "v"));
      });

      var allP = Q.all([parseResultP, compileResultP, runResultP]);
      return allP.then(function(results) {
        return {
          src: src,
          name: name,
          stats: {
            parse: results[0].stats,
            compile: results[1].stats,
            run: results[2].stats,
          }
        };
      });
    }

    return runtime.pauseStack(function(restarter) {
      var result = timePhases("x", "x = 5").then(function(r) {
        console.log(r.name, r.stats);
        return timePhases("loop", "for each(x from range(0, 1000)): x end");
      }).then(function(r) {
        console.log(r.name, r.stats);
        restarter.resume(runtime.makeModuleReturn({}, {})); 
      });
      result.fail(function(err) {
        console.log("Failed: ", err);
      });
    });
  }
}
