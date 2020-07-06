const readline = require('readline');
const OmloxRPC = require('../lib/omlox_rpc');

const omloxRPC = new OmloxRPC('ws://localhost:8081/v1/ws/rpc');
omloxRPC.on('wsConnected', (connected) => {
  if (connected) {
    omloxRPC.registerMethodCall('hello', (methodName, params, cb) => {
      cb(null, `Echo for ${methodName}`);
    }, []);
  }
});
omloxRPC.on('connectionStateChanged', (stateObj) => {
  console.log(`Old State: ${stateObj.oldState}`);
  console.log(`New State: ${stateObj.newState}`);
});

omloxRPC.connect();

const rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('method> ');
rl.prompt();
rl.on('line', (line) => {
  if (line === 'quit') {
    rl.close();
  } else if (line.startsWith('call')) {
    const elements = line.split(' ');
    omloxRPC.callMethod(elements[1])
      .then((result) => rl.write(JSON.stringify(result)))
      .catch((err) => rl.write(err));
  }
  rl.prompt();
}).on('close', () => {
  process.exit(0);
});
