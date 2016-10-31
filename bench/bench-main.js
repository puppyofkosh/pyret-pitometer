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

    function timePhases(prog) {
      if (prog.extension == 'js') {
        return timePhasesJs(prog.name, prog.src);
      } else if (prog.extension == 'arr') {
        return timePhasesArr(prog.name, prog.src);
      } else {
        throw new Error("invalid extension: " + prog.extension);
      }
    }

    function timePhasesJs(name, src) {
      global.gc();
      var runResultP = benchRepl.phased.execute(src);

      return runResultP.then(
        function(result) {
          if (runtime.isFailureResult(result)) {
            console.error("Error running program", result);
            throw {
              name: name,
              err: result
            };
          }
          console.log("Done running " + name, result.stats.time);
          console.log("Done running " + name, result.stats);
          var zeroStats = {"bounces":0,"tos":0,"time":[0, 0]};
          return {
            src: src,
            name: name,
            stats: {
              parse: zeroStats,
              compile: zeroStats,
              run: result.stats,
            }
          };
        },
        function(err) {
          throw {
            name: name,
            err: err
          };
        });
    }

    function timePhasesArr(name, src) {
      var parseResultP = benchRepl.phased.parse(src, name);
      var compileResultP = parseResultP.then(function(success) {
        global.gc();
        return benchRepl.phased.compile(success.result);
      });
      var runResultP = compileResultP.then(function(success) {
        global.gc();
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
    var programFiles = programNames.filter(function(p) {
      return p.endsWith(".arr") || p.endsWith(".js");
    });
    var onlyIncluded = programFiles.filter(function(p) {
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
    // http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
    function shuffle(array) {
      var counter = array.length;

      // While there are elements in the array
      while (counter > 0) {
        // Pick a random index
        let index = Math.floor(Math.random() * counter);

        // Decrease counter by 1
        counter--;

        // And swap the last element with it
        let temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
      }

      return array;
    }
    var toRun = shuffle(onlyExcluded);
    var programs = toRun.map(function(p) {
      var extension = 'js';
      if (p.endsWith('.arr')) {
        extension = 'arr';
      }
      return {
        name: p,
        src: String(fs.readFileSync(progBase + "/" + p)),
        extension: extension
      };
    });

    var RUNS = 10;

    return runtime.pauseStack(function(restarter) {
      var programPs = pmap(programs.map(function(p) {
        return function() {
          return Q.all(runNTimes(function() {
            return timePhases(p);
          }, RUNS)).then(function(r) {
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

          function getField(lst, phase, field) {
            var stats = pick(lst, ["stats", phase]);
            return stats.map(function(data) {
              return data[field];
            });
          }

          var lines = [
            beginning.concat([
              getTime(p, "parse")[0],
              0,
              0,
              math.mean(getTime(p.slice(1), "parse")),
              math.std(getTime(p.slice(1), "parse")),
              math.std(getTime(p.slice(1), "parse")) / Math.sqrt(RUNS - 1),
              math.mean(getTime(p, "parse")),
              math.std(getTime(p, "parse")),
              math.std(getTime(p, "parse")) / Math.sqrt(RUNS),
              getTime(p, "compile")[0],
              0,
              math.mean(getTime(p.slice(1), "compile")),
              math.std(getTime(p.slice(1), "compile")),
              math.std(getTime(p.slice(1), "compile")) / Math.sqrt(RUNS - 1),
              math.mean(getTime(p, "compile")),
              math.std(getTime(p, "compile")),
              math.std(getTime(p, "compile")) / Math.sqrt(RUNS),
              getTime(p, "run")[0],
              0,
              math.mean(getTime(p.slice(1), "run")),
              math.std(getTime(p.slice(1), "run")),
              math.std(getTime(p.slice(1), "run")) / Math.sqrt(RUNS - 1),
              math.mean(getTime(p, "run")),
              math.std(getTime(p, "run")),
              math.std(getTime(p, "run")) / Math.sqrt(RUNS),
              math.mean(getField(p, "run", "tos")),
              math.mean(getField(p, "run", "bounces"))
            ])
          ];

          lines.forEach(function(l) {
            fs.appendFileSync(options.outfile, l.join("\t"))
            fs.appendFileSync(options.outfile, "\n");
          });
        });
        printP.fail(function(err) {
          console.error("Error: ", err, err.err.exn);
        });
      });
    });
  }
})
