{
  requires: [
    { "import-type": "dependency",
      "protocol": "js-file",
      "args": ["bench-repl"]
    }
  ],
  nativeRequires: [],
  provides: {},
  theModule: function(runtime, _, uri, benchRepl) {

    function timeRestart(str) {
      var resultP = benchRepl.restartInteractions(str, false);
      return resultP.then(function(result) {
        if(!runtime.isSuccessResult(result)) {
          console.log("Failed: ", result);
        }
      });
    }

    return runtime.pauseStack(function(restarter) {
      timeRestart("x = 5").then(function(r) {
        return timeRestart("for each(x from range(0, 1000)): x end");
      }).then(function(_) {
        restarter.resume(runtime.makeModuleReturn({}, {})); 
      });
    });
  }
}
