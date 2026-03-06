const { exec } = require('child_process');
exec('ps aux | grep nodemon', (err, stdout, stderr) => {
  console.log(stdout);
});
