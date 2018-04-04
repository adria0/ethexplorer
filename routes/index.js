var express = require('express');
var router = express.Router();

var async = require('async');
var Web3 = require('web3');

var cliqueSigner = require('../utils/cliqueSigner');

router.get('/', async function(req, res, next) {
  
  var config = req.app.get('config');  
  var web3 = new Web3();
  web3.setProvider(config.provider);
  
  const lastBlock = await web3.eth.getBlock("latest", false)
  var blocks = [];
  var blockCount = 10;

  if (lastBlock.number - blockCount < 0) {
    blockCount = lastBlock.number + 1;
  }
  for (n=0;n<blockCount;n++) {
    blocks.push(web3.eth.getBlock(lastBlock.number - n, true))
  }
  for (n=0;n<blocks.length;n++) {
    blocks[n] = await blocks[n]
    blocks[n].miner=cliqueSigner(blocks[n])
  }

  const txdb = req.app.get('txdb');
  const txs = await txdb.get("lasttx")

  console.log(txs)

  res.render('index', { blocks: blocks, txs: txs });

/*

  async.waterfall([
    function(callback) {
      web3.eth.getBlock("latest", false, function(err, result) {
        callback(err, result);
      });
    }, function(lastBlock, callback) {
      var blocks = [];
      
      var blockCount = 10;
      
      if (lastBlock.number - blockCount < 0) {
        blockCount = lastBlock.number + 1;
      }
      
      async.times(blockCount, function(n, next) {
        web3.eth.getBlock(lastBlock.number - n, true, function(err, block) {
          block.miner=cliqueSigner(block)
          next(err, block);
        });
      }, function(err, blocks) {
        callback(err, blocks);
      });
    }
  ], function(err, blocks) {
    if (err) {
      return next(err);
    }
    
    var txs = [];
    blocks.forEach(function(block) {
      block.transactions.forEach(function(tx) {
        if (txs.length === 10) {
          return;
        }
        txs.push(tx);
      });
    });
    res.render('index', { blocks: blocks, txs: txs });
  });
  */
});

module.exports = router;
