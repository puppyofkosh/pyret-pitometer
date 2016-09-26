define(["child_process"], function(child_process) {

  function checkout(base, commit) {
    var dirName = "build-space/pyret-lang-" + commit
    child_process.execSync("git clone " + base + " " + dirName);
    child_process.execSync("git checkout " + commit, { cwd: dirName });
  }

  return {
    checkout: checkout
  };
});

