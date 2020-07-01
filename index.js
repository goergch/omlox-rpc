var stdin = process.openStdin();

const OmloxRPC = new require('./lib/omlox_rpc');
const omloxRPC = new OmloxRPC("ws://localhost:8081/v1/ws/rpc",[{methodname:'hello'}, {methodname:'test', zoneid: "7F9C779C-520E-4ECA-91FF-D1CFC74D7DAD"}]);
omloxRPC.connect();

var readline = require('readline');
var rl = readline.createInterface(process.stdin, process.stdout);
rl.setPrompt('method> ');
rl.prompt();
rl.on('line', function(line) {
    if (line === "quit"){
        rl.close();
    }
    else if (line.startsWith('call')) {
        var elements = line.split(" ");
        omloxRPC.callMethod(elements[1]).then((result)=> rl.write(JSON.stringify(result))).catch((err)=> rl.write(err));
    } 
    rl.prompt();
}).on('close',function(){
    process.exit(0);
});