var express = require('express');
var router = express.Router();

var async = require('async');
var Web3 = require('web3');
var abi = require('ethereumjs-abi');
var abiDecoder = require('abi-decoder');

router.get('/pending', function(req, res, next) {
  
  var config = req.app.get('config');  
  var web3 = new Web3();
  web3.setProvider(config.provider);
  
  async.waterfall([
    function(callback) {
      web3.parity.pendingTransactions(function(err, result) {
        callback(err, result);
      });
    }
  ], function(err, txs) {
    if (err) {
      return next(err);
    }
    
    res.render('tx_pending', { txs: txs });
  });
});


router.get('/submit', function(req, res, next) {  
  res.render('tx_submit', { });
});

router.post('/submit', function(req, res, next) {
  if (!req.body.txHex) {
    return res.render('tx_submit', { message: "No transaction data specified"});
  }
  
  var config = req.app.get('config');  
  var web3 = new Web3();
  web3.setProvider(config.provider);
  
  async.waterfall([
    function(callback) {
      web3.eth.sendRawTransaction(req.body.txHex, function(err, result) {
        callback(err, result);
      });
    }
  ], function(err, hash) {
    if (err) {
      res.render('tx_submit', { message: "Error submitting transaction: " + err });
    } else {
      res.render('tx_submit', { message: "Transaction submitted. Hash: " + hash });
    }
  });
});

router.get('/:tx', function(req, res, next) {
  
  var config = req.app.get('config');  
  var web3 = new Web3();
  web3.setProvider(config.provider);
  
  var db = req.app.get('db');
  
  async.waterfall([
    function(callback) {
      web3.eth.getTransaction(req.params.tx, function(err, result) {
        callback(err, result);
      });
    }, function(result, callback) {
      
      if (!result || !result.hash) {
        return callback({ message: "Transaction hash not found" }, null);
      }
      
      web3.eth.getTransactionReceipt(result.hash, function(err, receipt) {
        callback(err, result, receipt);
      });
    }, function(tx, receipt, callback) {  
       
      web3.currentProvider.sendAsync({
        method: "debug_traceTransaction",
        params: [tx.hash, {tracer: "callTracer"}],
        jsonrpc: "2.0",
        id: "2"
      }, function (err, traces) {

       function qdump(x) {
          v = [JSON.parse(JSON.stringify(x))];
          if ('calls' in v[0]) {
            for (i=0;i<v[0].calls.length;i++) {
              v=v.concat(qdump(v[0].calls[i]));
            }
            delete v[0]["calls"]
          }
          return v       
        }
        callback(err, tx, receipt, qdump(traces.result)); 
      });
    }, function(tx, receipt, traces, callback) {
      db.get(tx.to, function(err, value) {
        callback(null, tx, receipt, traces, value);
      });
    }
  ], function(err, tx, receipt, traces, source) {
    if (err) {
      return next(err);
    }
    console.log(receipt)
    // Try to match the tx to a solidity function call if the contract source is available
    if (source) {
      tx.source = JSON.parse(source);
      try {
        var jsonAbi = JSON.parse(tx.source.abi);
        abiDecoder.addABI(jsonAbi);
        tx.callInfo = abiDecoder.decodeMethod(tx.input);  
      } catch (e) {
        console.log("Error parsing ABI:", tx.source.abi, e);
      }
    }
    function chunkSubstr(str, size) {
      const numChunks = Math.ceil(str.length / size)
      const chunks = new Array(numChunks)
    
      for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks[i] = str.substr(o, size)
      }
    
      return chunks
    }

    tx.logs = []
    for (var i=0;i<receipt.logs.length;i++) {
      const log = receipt.logs[i]
      if (tx.callInfo && log.address==tx.to) {
         tx.logs.push(abiDecoder.decodeLogs([log])[0]);
      } else {
         raw = log.data.substring(2)
         console.log("LOGDATA",log.data)
         rawchunked = chunkSubstr(raw,64)
         logentry = {
           address: log.address,
           name: "unknown",
           events : []
         }
         for (c=0;c<rawchunked.length;c++) {
           var event = {}
           event.name = '['+c+']'
           event.type = ''
           event.value = '0x'+rawchunked[c]
           logentry.events.push(event)
         }
         tx.logs.push(logentry)
      }
   }

    tx.traces = [];
    tx.failed = false;
    tx.gasUsed = 0;

    if (traces != null) {
    traces.forEach(function(trace) {
        tx.traces.push(trace);
        if (trace.error) {
          tx.failed = true;
          tx.error = trace.error;
        }
        if (trace.result && trace.result.gasUsed) {
          tx.gasUsed += parseInt(trace.result.gasUsed, 16);
        }
      });
    }
    // console.log(tx.traces);    
    res.render('tx', { tx: tx });
  });
  
});

router.get('/raw/:tx', function(req, res, next) {
  
  var config = req.app.get('config');  
  var web3 = new Web3();
  web3.setProvider(config.provider);
  
  async.waterfall([

    function(callback) {
      web3.eth.getTransaction(req.params.tx, function(err, result) {
        callback(err, result);
      });
    },

    function(result, callback) {
      web3.currentProvider.sendAsync({
        method: "debug_traceTransaction",
        params: [result.hash, {tracer: "callTracer"}],
        jsonrpc: "2.0",
        id: "2"
      }, function (err, traces) {
        tx = {
          txid: req.params.tx,
          traces: {
            trace: traces.result,
            vmTrace: '',  
          }
        }
        callback(err, tx); 
      });
    },

    function(tx, callback) {
      console.log("TX",tx,"CALLBACK",callback)
      web3.currentProvider.sendAsync({
        method: "debug_traceTransaction",
        params: [tx.txid],
        jsonrpc: "2.0",
        id: "2"
      }, function (err, traces) {
        console.log(tx)
        tx.traces.vmTrace = traces
        callback(err, tx); 
      });
    },
    
      /*
      web3.trace.replayTransaction(result.hash, ["trace", "stateDiff", "vmTrace"], function(err, traces) {
        callback(err, result, traces);
      });
      */
  ], function(err, traces) {
    if (err) {
      return next(err);
    }
    
    console.log('tx_raw',traces)   

    res.render('tx_raw', { tx: traces });
  });
});

module.exports = router;
