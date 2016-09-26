({
  requires: [
    { "import-type": "dependency",
      protocol: "file",
      args: ["../pyret/src/arr/compiler/compile-lib.arr"]
    },
    { "import-type": "dependency",
      protocol: "file",
      args: ["../pyret/src/arr/compiler/compile-structs.arr"]
    },
    { "import-type": "dependency",
      protocol: "file",
      args: ["../pyret/src/arr/compiler/repl.arr"]
    },
    { "import-type": "dependency",
      protocol: "file",
      args: ["./bench-helpers.arr"]
    },
    { "import-type": "builtin",
      name: "parse-pyret"
    },
    { "import-type": "builtin",
      name: "runtime-lib"
    },
    { "import-type": "builtin",
      name: "load-lib"
    },
    { "import-type": "builtin",
      name: "builtin-modules"
    }
  ],
  nativeRequires: [
    "bench/bench-builtin-modules",
    "pyret-base/js/runtime",
    "q"
  ],
  provides: {},
  theModule: function(runtime, namespace, uri,
                      compileLib, compileStructs, pyRepl, benchHelpers,
                      parsePyret, runtimeLib, loadLib, builtinModules,
                      benchModules, rtLib, Q) {
    var gf = runtime.getField;
    var gmf = function(m, s) {
      return gf(gf(m, "values"), s);
    }

    function uriFromDependency(dependency) {
      return runtime.ffi.cases(gmf(compileStructs, "is-Dependency"), "Dependency", dependency,
        {
          builtin: function(name) {
            return "builtin://" + name;
          },
          dependency: function(protocol, args) {
            var arr = runtime.ffi.toArray(args);
            if (protocol === "my-gdrive") {
              return "my-gdrive://" + arr[0];
            }
            else if (protocol === "shared-gdrive") {
              return "shared-gdrive://" + arr[0] + ":" + arr[1];
            }
            else if (protocol === "gdrive-js") {
              return "gdrive-js://" + arr[1];
            }
            else {
              console.error("Unknown import: ", dependency);
            }
          }
        });

    }

    function makeFindModule() {
      // The locatorCache memoizes locators for the duration of an
      // interactions run
      var locatorCache = {};
      function findModule(contextIgnored, dependency) {
        var uri = uriFromDependency(dependency);
        if(locatorCache.hasOwnProperty(uri)) {
          return gmf(compileLib, "located").app(locatorCache[uri], runtime.nothing);
        }
        return runtime.safeCall(function() {
          return runtime.ffi.cases(gmf(compileStructs, "is-Dependency"), "Dependency", dependency,
            {
              builtin: function(name) {
                var raw = benchModules.getBuiltinLoadableName(runtime, name);
                if(!raw) {
                  throw runtime.throwMessageException("Unknown module: " + name);
                }
                else {
                  return gmf(benchHelpers, "make-builtin-js-locator").app(name, raw);
                }
              },
              dependency: function(protocol, args) {
                var arr = runtime.ffi.toArray(args);
                console.error("Unknown import: ", dependency);

              }
            });
         }, function(l) {
            locatorCache[uri] = l;
            return gmf(compileLib, "located").app(l, runtime.nothing);
         }, "findModule");
      }
      return runtime.makeFunction(findModule, "cpo-find-module");
    }

    // NOTE(joe): This line is "cheating" by mixing runtime levels,
    // and uses the same runtime for the compiler and running code.
    // Usually you can only get a new Runtime by calling create, but
    // here we magic the current runtime into one.
    var pyRuntime = gf(gf(runtimeLib, "internal").brandRuntime, "brand").app(
      runtime.makeObject({
        "runtime": runtime.makeOpaque(runtime)
      }));
    var pyRealm = gf(loadLib, "internal").makeRealm(benchModules.getRealm());


    var builtins = [];
    Object.keys(runtime.getParam("staticModules")).forEach(function(k) {
      if(k.indexOf("builtin://") === 0) {
        builtins.push(runtime.makeObject({
          uri: k,
          raw: benchModules.getBuiltinLoadable(runtime, k)
        }));
      }
    });
    var builtinsForPyret = runtime.ffi.makeList(builtins);

    var replGlobals = gmf(compileStructs, "standard-globals");

    var defaultOptions = gmf(compileStructs, "default-compile-options");

    var replP = Q.defer();
    return runtime.safeCall(function() {
        return gmf(benchHelpers, "make-repl").app(
            builtinsForPyret,
            pyRuntime,
            pyRealm,
            runtime.makeFunction(makeFindModule));
      }, function(repl) {
        var jsRepl = {
          runtime: runtime.getField(pyRuntime, "runtime").val,
          restartInteractions: function(programStr, typeCheck) {
            var programThunk = runtime.makeFunction(function() {
              return programStr;
            });
            var options = defaultOptions.extendWith({"type-check": typeCheck});
            var ret = Q.defer();
            setTimeout(function() {
              runtime.runThunk(function() {
                return runtime.safeCall(
                  function() {
                    return gf(repl,
                    "make-definitions-locator").app(programThunk, replGlobals);
                  },
                  function(locator) {
                    return gf(repl, "restart-interactions").app(locator, options);
                  });
              }, function(result) {
                ret.resolve(result);
              });
            }, 0);
            return ret.promise;
          },
          run: function(str, name) {
            var ret = Q.defer();
            setTimeout(function() {
              runtime.runThunk(function() {
                return runtime.safeCall(
                  function() {
                    return gf(repl,
                    "make-interaction-locator").app(
                      runtime.makeFunction(function() { return str; }))
                  },
                  function(locator) {
                    return gf(repl, "run-interaction").app(locator);
                  });
              }, function(result) {
                ret.resolve(result);
              }, "make-interaction-locator");
            }, 0);
            return ret.promise;
          },
          pause: function(afterPause) {
            runtime.schedulePause(function(resumer) {
              afterPause(resumer);
            });
          },
          stop: function() {
            runtime.breakAll();
          },
          runtime: runtime
        };
        return runtime.makeJSModuleReturn(jsRepl);
      }, "make-repl");

  }
})
