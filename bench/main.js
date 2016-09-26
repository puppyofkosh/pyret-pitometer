var require = require('requirejs');
require(["./checkout-pyret", "child_process", "fs"], function(checkoutPyret, childProcess, fs) {
  console.log("Running...");

  var commit = "a0e0632a83fef0a1c4d83eba1742a6957ca53fd5";
  var workDir = "build-space/pyret-lang-" + commit;

  if(!fs.existsSync(workDir)) {
    checkoutPyret.checkout("../pyret-lang/", "a0e0632a83fef0a1c4d83eba1742a6957ca53fd5");
}
  var start = process.hrtime();
  childProcess.execSync("make phaseA", { cwd: workDir });
  var end = process.hrtime(start);

  console.log("Took: ", end[0] + "." + end[1]);



  var compiledDir = "build-space/compiled/" + commit;
  var mkdir = "mkdir -p " + compiledDir;
  var link = "unlink pyret; ln -s " + workDir + " pyret";
  var stealWork = "cp pyret/build/phaseA/compiled/*.js " + compiledDir;
  var build = 
  "node pyret/build/phaseA/pyret.jarr \
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
