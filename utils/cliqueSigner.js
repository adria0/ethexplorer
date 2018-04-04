var ethUtil = require('ethereumjs-util');
var ethBlock = require('ethereumjs-block');

function cliqueSigner (blockParams) {
      const blockHeader = new ethBlock.Header({
        parentHash: blockParams.parentHash,
        uncleHash: blockParams.sha3Uncles,
        coinbase: blockParams.miner,
        stateRoot: blockParams.stateRoot,
        transactionsTrie: blockParams.transactionsRoot,
        receiptTrie: blockParams.receiptsRoot,
        bloom: blockParams.logsBloom,
        difficulty: blockParams.difficulty,
        number: blockParams.number,
        gasLimit: blockParams.gasLimit,
        gasUsed: blockParams.gasUsed,
        timestamp: blockParams.timestamp,
        extraData: blockParams.extraData.substring(0,2+(32*2)),
        mixHash: blockParams.mixHash,
        nonce: blockParams.nonce
      })
  
      msgHash = ethUtil.sha3(ethUtil.rlp.encode(blockHeader.raw))
      signature = ethUtil.fromRpcSig('0x'+blockParams.extraData.substring(2+32*2))
      publicKey = ethUtil.ecrecover(msgHash,signature.v,signature.r,signature.s)
      return '0x'+ethUtil.pubToAddress(publicKey).toString('hex')
}

module.exports = cliqueSigner;
