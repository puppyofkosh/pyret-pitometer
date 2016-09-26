var require = require('requirejs');
require(["./checkout-pyret", "child_process"], function(checkoutPyret, childProcess) {
  console.log("Running...");

  var commit = "a0e0632a83fef0a1c4d83eba1742a6957ca53fd5";
  var workDir = "build-space/pyret-lang-" + commit;

  checkoutPyret.checkout("../pyret-lang/", "a0e0632a83fef0a1c4d83eba1742a6957ca53fd5");

  var start = process.hrtime();
  childProcess.execSync("make phaseA", { cwd: workDir });
  var end = process.hrtime(start);

  console.log("Took: ", end[0] + "." + end[1]);

  start = process.hrtime();
  childProcess.execSync("make phaseB", { cwd: workDir });
  end = process.hrtime(start);

  console.log("Took: ", end[0] + "." + end[1]);
});
