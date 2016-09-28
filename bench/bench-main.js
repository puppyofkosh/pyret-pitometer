({
  requires: [
    { "import-type": "dependency",
      "protocol": "js-file",
      "args": ["bench-repl"]
    }
  ],
  nativeRequires: ["q", "command-line-args", "mathjs"],
  provides: {},
  theModule: function(runtime, _, uri, benchRepl, Q, commandLineArgs, math) {

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

    function pmap(fs) {
      if (fs.length === 0) { return Q.fcall(function() { return []; }); }
      else {
        var f = fs.pop();
        var p = f();
        var rest = p.then(function(_) {
          return pmap(fs);
        });
        return Q.all([p, rest]).then(function(res) {
          return [res[0]].concat(res[1]);
        });
      }
    }

    function runNTimes(f, n) {
      var fs = [];
      for(var i = 0; i < n; i++) {
        fs.push(f);
      }
      return pmap(fs);
    }

    var programs = [
      { name: "x",
        src: "x = 5"
      },
      { name: "loop",
        src: "for each(x from range(0, 1000)): x end"
      }
    ];
      

    return runtime.pauseStack(function(restarter) {
      var programsP = pmap(programs.map(function(p) {
        return function() {
          return runNTimes(function() {
            return timePhases(p.name, p.src);
          }, 5);
        };
      }));
      
      var done = programsP.then(function(programs) {
        programs.forEach(function(p) {
          console.log(p);

          var beginning = [p[0].name];

          function pick(l, keys) {
            return l.map(function(elt) {
              var ans = elt;
              keys.forEach(function(k) {
                ans = ans[k];
              });
              return ans;
            });
          }

          function getTime(lst, field) {
            var stats = pick(lst, ["stats", field]);
            return stats.map(function(data) {
              return data.time[0] + (data.time[1] / 1000000000)
            });
          }

          var lines = [
            beginning.concat([
              "parse-first",
              getTime(p, "parse")[0],
              0
            ]),
            beginning.concat([
              "parse-mean-rest",
              math.mean(getTime(p.slice(1), "parse")),
              math.std(getTime(p.slice(1), "parse"))
            ]),
            beginning.concat([
              "parse-mean-all",
              math.mean(getTime(p, "parse")),
              math.std(getTime(p, "parse"))
            ]),
            beginning.concat([
              "compile",
              getTime(p, "compile")[0],
              0
            ]),
            beginning.concat([
              "compile-mean-rest",
              math.mean(getTime(p.slice(1), "compile")),
              math.std(getTime(p.slice(1), "compile"))
            ]),
            beginning.concat([
              "compile-mean-all",
              math.mean(getTime(p, "compile")),
              math.std(getTime(p, "compile"))
            ]),
            beginning.concat([
              "run",
              getTime(p, "run")[0],
              0
            ]),
            beginning.concat([
              "run-mean-rest",
              math.mean(getTime(p.slice(1), "run")),
              math.std(getTime(p.slice(1), "run"))
            ]),
            beginning.concat([
              "run-mean-all",
              math.mean(getTime(p, "run")),
              math.std(getTime(p, "run"))
            ])
          ];

          lines.forEach(function(l) {
            console.log(l.join(","));
          });
        });
      });

      done.fail(function(err) {
        console.log("Failed: ", err);
      });
    });
  }
})
