const logger = require('./logger');
const EventEmitter = require('events').EventEmitter;
var WebSocketClient = require('websocket').client;
let methodIdCounter = 0;
const createJsonRpcCall = function(methodname, params, mode, timeout){
    methodIdCounter++;
    call = {
        jsonrpc: "2.0",
        method: methodname,
        id: methodIdCounter
    };
    if(params != undefined){
        call.params = params;
    }
    if(mode !== undefined){
        if(mode === OmloxRPC.CALLMODES.STREAM){
            call.stream = true;
        }else if(mode === OmloxRPC.CALLMODES.AGGREGATE){
            call.AGGREGATE = true;
        }
    }
    if(timeout != undefined){
        call.timeout = timeout;
    }
    return call
}

const createJsonRpcResultMessage = function(id, result){
    call = {
        jsonrpc: "2.0",
        result: result,
        id: id
    };
    return call
}

const createJsonRpcErrorMessage = function(id, error){
    call = {
        jsonrpc: "2.0",
        error: error,
        id: id
    };
    return call
}



const registerMethod = function (methodname, connection, zoneid) {
    return new Promise((resolve, reject) => {
        var params = {'method':methodname};
        if(zoneid !== undefined){
            params.zone_id = zoneid;
        }
        let call = createJsonRpcCall('register', params);
        rpcCall(call,connection).then((result)=>{
            if(result == true){
                resolve();
            }else
            {
                reject()
            }
        }).catch((err)=>reject(err));

    });
}

const rpcResult = function(resultMessage, connection) {
    return new Promise((resolve, reject) => {
        
        connection.send(JSON.stringify(resultMessage));

        logger.debug("Sent result: "+JSON.stringify(resultMessage))
        resolve();
    });
}


const rpcCall = function(call, connection) {
    return new Promise((resolve, reject) => {
        let handleMessage = function(message){
            var msgObj = JSON.parse(message.utf8Data)
            if(msgObj.jsonrpc && msgObj.jsonrpc === '2.0' && msgObj.id === call.id && msgObj.method === undefined){
                if(msgObj.error){
                    reject(msgObj.error);
                    if(!call.stream){
                        connection.removeListener('message', handleMessage);
                    }
                }else if(msgObj.result === undefined){
                    reject("no result");
                }else {
                    resolve(msgObj.result);
                    if(!call.stream){
                        connection.removeListener('message', handleMessage);
                    }
                }
            }
        }
        connection.on('message',handleMessage);
        var timeoutMs = 30000;
        if(call.timeout !==undefined){
            timeoutMs = call.timeout;
        }
        var timeout = setTimeout(()=>{
            connection.removeListener('message', handleMessage);
        },timeoutMs);
        connection.send(JSON.stringify(call));
        logger.debug("Sent call: " + JSON.stringify(call))
    });
}

class OmloxRPC extends EventEmitter{
    
    constructor(address){
        super();
        this.connection = null;
        this.methods = {};
        this.address = address;
        this.client = new WebSocketClient();
        this.client.on('connect', (connection)=>this.onWebsocketConnect(connection))
        this.client.on('connectFailed', (errorDescription)=>this.onWebsocketConnectFailed(errorDescription))
    }

    connect(){
        logger.debug("OmloxRPC connect")

        this.client.connect(this.address);
    }

    // Websocket Events
    onWebsocketConnect(connection){
        
        logger.debug("OmloxRPC connection successful")
        this.connection = connection;
        this.connection.on('message', (message)=>this.onMessage(message));
        this.connection.on('close', (reasonCode, description)=>this.onClose(reasonCode, description));
        this.connection.on('error', (error)=>this.onError(error));
        this.emit('wsConnected', true);
    }
    onWebsocketConnectFailed(errorDescription){
        this.emit('wsConnected', false);
        logger.info("OmloxRPC connection failed:", errorDescription)
        this.connection = null;
    }

    onError(error){
        logger.info("OmloxRPC connection error:", error)

    }
    onMessage(message){
        var msgObj = JSON.parse(message.utf8Data)
        logger.debug("Got message: "+message.utf8Data)
        if (msgObj.jsonrpc && msgObj.jsonrpc === '2.0' && msgObj.method !== undefined){
            if(this.methods[msgObj.method] !== undefined ){
                //handle method
                if(this.methods[msgObj.method].callback !== undefined)
                {
                    this.methods[msgObj.method].callback(msgObj.method, msgObj.params,(err,result)=>{
                        if(err === undefined || err === null){
                            var resultMsg = createJsonRpcResultMessage(msgObj.id, result);
                            rpcResult(resultMsg,this.connection);
                        }else{
                            var errMsg = createJsonRpcErrorMessage(msgObj.id, err);
                            rpcResult(errMsg,this.connection);
                        }
                        
                    })
                }else{

                    var resultMsg = createJsonRpcResultMessage(msgObj.id, result);
                    rpcResult(resultMsg,this.connection);
                }
            }
        }
    }
    onClose(reasonCode, description){

        this.emit('wsConnected', false);
        logger.info("OmloxRPC connection close:", description)
        this.connection = null;
    }
    callMethod(methodname, params, mode, timeout){
        return new Promise((resolve,reject)=>{
            let call = createJsonRpcCall(methodname, params, mode, timeout);
            rpcCall(call, this.connection).then((result)=>{
                resolve(result);
            })
            .catch((err)=>{
                reject(err);
            })
        });
    }
    registerMethodCall(methodName, callback, args){
        return new Promise((resolve, reject)=>{
            if(this.methods[methodName] !== undefined){
                logger.error("Already registered the method: " + methodName);
                reject("Already registered the method: " + methodName)
            }
            this.methods[methodName] = {
                callback: callback,
                args: args
            } 
            registerMethod(methodName, this.connection)
                        .then(()=>{
                            logger.info("registered method " + methodName);
                            resolve();
                        })
                        .catch((err)=>{
                            logger.error("Error on registering method " + methodName + ": " + err);
                            reject(err);
                        })
        });
        
    }
}
OmloxRPC.CALLMODES = {
    NORMAL: "normal",
    AGGREGATE: "aggregate",
    STREAM: "stream"
}
module.exports = OmloxRPC;