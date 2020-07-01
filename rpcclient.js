var WebSocket = require('rpc-websockets').Client
var ws = new WebSocket('ws://localhost:8081/v1/ws/rpc')
ws.on('open',()=>{
    ws.subscribe('hello')
    ws.on('hello', (message)=>{
        console.log(message);
    });
    ws.call('register',{"method":"hello"}).then((response)=>{
        console.log(response)
    }).catch((err)=>console.log(err))
})
