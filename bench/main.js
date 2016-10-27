var require = require('requirejs');
require(["./checkout-pyret", "child_process", "fs", "command-line-args"], function(checkoutPyret, childProcess, fs, commandLineArgs) {

  const optionDefinitions = [
    { name: 'commit', alias: 'c', type: String },
    { name: 'repo', alias: 'r', type: String },
    { name: 'outfile', alias: 'o', type: String },
    { name: 'include', alias: 'i', type: String, multiple: true },
    { name: 'exclude', alias: 'e', type: String, multiple: true }
  ]
  const options = commandLineArgs(optionDefinitions)

  console.log("Running...");

  var commit = options.commit;
  var workDir = "build-space/pyret-lang-" + commit;
  var base = options.repo;

  if(!fs.existsSync(workDir)) {
    checkoutPyret.checkout(base, commit);
  }
  var start = process.hrtime();
  childProcess.execSync("make phaseB", { cwd: workDir });
  var end = process.hrtime(start);

  console.log("phaseB took: ", end[0] + "." + end[1]);

  var compiledDir = "build-space/compiled/" + commit;
  var outfileJarr = "build-space/run-" + commit + ".jarr"

  var mkdir = "mkdir -p " + compiledDir;
  var link = "unlink pyret; ln -s " + workDir + " pyret";
  var stealWork = "cp pyret/build/phaseB/compiled/*.js " + compiledDir;
  var build = 
  "node --expose-gc pyret/build/phaseB/pyret.jarr \
    -allow-builtin-overrides \
    --builtin-js-dir bench/ \
    --builtin-js-dir pyret/src/js/trove/ \
    --builtin-arr-dir pyret/src/arr/trove/ \
    --require-config bench/bench-config.json \
    --build-runnable bench/bench-main.arr \
    --standalone-file bench/bench-standalone.js \
    --compiled-dir " + compiledDir + " \
    --outfile " + outfileJarr + " -no-check-mode\
  ";
  var include = options.include ?
    " --include " + options.include.join(" ") : "";
  var exclude = options.exclude ?
    " --exclude " + options.exclude.join(" ") : "";
  var run =
  "node --expose-gc " + outfileJarr + include + exclude +
    " --outfile " + options.outfile +
    " --commit " + options.commit;

  childProcess.execSync(mkdir);
  childProcess.execSync(link);
  childProcess.execSync(stealWork);
  childProcess.execSync(build);
  console.log("Running: \n");
  console.log(run);
  childProcess.execSync(run, {stdio: [0, 1, 2]});

});
