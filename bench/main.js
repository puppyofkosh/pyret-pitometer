var require = require('requirejs');
require(["./checkout-pyret", "child_process", "fs"], function(checkoutPyret, childProcess, fs) {
  console.log("Running...");

  var commit = "2662176";
  var workDir = "build-space/pyret-lang-" + commit;
  var base = "../pyret-lang-return/";

  if(!fs.existsSync(workDir)) {
    checkoutPyret.checkout(base, commit);
  }
  var start = process.hrtime();
  childProcess.execSync("make phaseB", { cwd: workDir });
  var end = process.hrtime(start);

  console.log("phaseB took: ", end[0] + "." + end[1]);



  var compiledDir = "build-space/compiled/" + commit;
  var mkdir = "mkdir -p " + compiledDir;
  var link = "unlink pyret; ln -s " + workDir + " pyret";
  var stealWork = "cp pyret/build/phaseB/compiled/*.js " + compiledDir;
  var build = 
  "node pyret/build/phaseB/pyret.jarr \
    -allow-builtin-overrides \
    --builtin-js-dir bench/ \
    --builtin-js-dir pyret/src/js/trove/ \
    --builtin-arr-dir pyret/src/arr/trove/ \
    --require-config bench/bench-config.json \
    --build-runnable bench/bench-main.arr \
    --standalone-file bench/bench-standalone.js \
    --compiled-dir " + compiledDir + " \
    --outfile build-space/run-" + commit + ".jarr -no-check-mode\
  ";

  childProcess.execSync(mkdir);
  childProcess.execSync(link);
  childProcess.execSync(stealWork);
  childProcess.execSync(build);
});
