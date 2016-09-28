({
  requires: [
    { "import-type": "dependency",
      "protocol": "js-file",
      "args": ["bench-repl"]
    }
  ],
  nativeRequires: ["q", "command-line-args", "mathjs", "fs"],
  provides: {},
  theModule: function(runtime, _, uri, benchRepl, Q, commandLineArgs, math, fs) {

    const optionDefinitions = [
      { name: 'commit', alias: 'c', type: String },
      { name: 'outfile', alias: 'o', type: String },
      { name: 'include', alias: 'i', multiple: true, type: String, defaultValue: [""] },
      { name: 'exclude', alias: 'e', multiple: true, type: String, defaultValue: [] }
    ]
    const options = commandLineArgs(optionDefinitions)
    var commit = options.commit;

    function timePhases(name, src) {
      var parseResultP = benchRepl.phased.parse(src, name);
      var compileResultP = parseResultP.then(function(success) {
        return benchRepl.phased.compile(success.result);
      });
      var runResultP = compileResultP.then(function(success) {
        return benchRepl.phased.execute(runtime.getField(success.result, "v"));
      });

      var allP = Q.all([parseResultP, compileResultP, runResultP]);
//      var failP = allP.fail();
      var doneP = 
        allP.then(function(results) {
          console.log("Done running " + name, results[0].stats.time, results[1].stats.time, results[2].stats.time);
          return {
            src: src,
            name: name,
            stats: {
              parse: results[0].stats,
              compile: results[1].stats,
              run: results[2].stats,
            }
          };
        }, 
        function(err) {
          throw {
            name: name,
            err: err
          };
        });
      return doneP;
    }

    function pmap(fs) {
      function loop(prev, processing, soFar) {
        if(processing.length === 0) {
          console.log(soFar);
          return soFar;
        }
        else {
          var first = processing[0];
          if(prev === null) {
            var next = first();
          }
          else {
            var next = prev.then(first, first);
          }
          return loop(next, processing.slice(1), soFar.concat([next]));
        }
      }
      return loop(null, fs, []);
    }


    function runNTimes(f, n) {
      var fs = [];
      for(var i = 0; i < n; i++) {
        fs.push(f);
      }
      return pmap(fs);
    }

    var progBase = "bench/programs";
    var programNames = fs.readdirSync(progBase);
    var arrFiles = programNames.filter(function(p) {
      return (p.indexOf(".arr") === p.length - 4)
    });
    var onlyIncluded = arrFiles.filter(function(p) {
      var found = false;
      options.include.forEach(function(i) {
        found = found || (p.indexOf(i) !== -1);
      });
      return found;
    });
    var onlyExcluded = onlyIncluded.filter(function(p) {
      var found = true;
      options.exclude.forEach(function(e) {
        found = found && (p.indexOf(e) === -1);
      });
      return found;
    });
    var toRun = onlyExcluded;
    var programs = toRun.map(function(p) {
      return {
        name: p,
        src: String(fs.readFileSync(progBase + "/" + p))
      };
    });

    return runtime.pauseStack(function(restarter) {
      var programPs = pmap(programs.map(function(p) {
        return function() {
          return Q.all(runNTimes(function() {
            return timePhases(p.name, p.src);
          }, 5)).then(function(r) {
            return r; 
          });
        };
      }));

      programPs.forEach(function(program) {
        var printP = program.then(function(p) {

          var beginning = [commit, p[0].name];

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
            fs.appendFileSync(options.outfile, l.join(","))
            fs.appendFileSync(options.outfile, "\n");
          });
        });
        printP.fail(function(err) {
          console.error("Error: ", err);
        });
      });
    });
  }
})
