/**
 * IOTA engine
 */
 'use strict'

var pjson = require('./package.json')
var IOTA = require('iota.lib.js') // MIT license
const iotaTools = require('./localPow/iotatools.js')

var config = require('./iota-engine-config') // iota engine config

var iota // iota api object
var seed // iota account used
var curl
var ffi
var webgl2 = false

const MAX_TIMESTAMP_VALUE = (Math.pow(3, 27) - 1) / 2 // from curl.min.js

// Test for webgl2
function isWebGL2 (gl) {
  if (!gl) return false
  return (typeof WebGL2RenderingContext !== 'undefined' &&
      gl instanceof WebGL2RenderingContext)
}
// On the browser, that returns 0, but running in node, it will be > 0.
function isNode () {
  return process && typeof process.env === 'object' && Object.keys(process.env).length
}

/**
* Init IOTA node and set seed - server-side
*/
function initServer (newSeed, node) {
  seed = newSeed
  if (node) { iota = new IOTA({ 'provider': node}) }
  else // DEFAULT node from config file is used
  { iota = new IOTA({ 'provider': config.provider}) }
}

/**
* Init IOTA node - client-side
*/
function initClient (node) {
  if (node) { iota = new IOTA({ 'provider': node}) }
  else // DEFAULT node from config file is used
  { iota = new IOTA({ 'provider': config.provider}) }

  webgl2 = false
  // web
  if (typeof (document) !== 'undefined') {
    // use webgl 2.0 required for webgl2 pow with curl
    var canvas = document.createElement('canvas')
    if (isWebGL2(canvas.getContext('webgl2'))) {
      webgl2 = true
      console.log('webgl2 is supported! ')
      initCurl()
      iota.api.attachToTangle = webglAttachToTangle
      return 0
    }

    console.log('webgl2 not supported, switching to native lib for curl!')
    initCurl()
    iota.api.attachToTangle = localAttachToTangle
    return 0
  }
  // pure node
  else {
    if (isNode()) {
      console.log('webgl2 not supported, switching to native lib for curl!')
      initCurl()
      iota.api.attachToTangle = localAttachToTangle
    }
    else {
      console.log('node environment not found, nor web, exit')
      return -2
    }
  }
  console.log('IOTA engine initiated!')
}

/**
*   init curl - use webgl2 for web or fallback to native lib
*
*   @param {bool} isWeb true = web, false = native
**/
function initCurl () {
  console.log(process.arch)
  if (webgl2) {
    curl = require('curl.lib.js') // GNU v3.0 license
  }
  else {
    ffi = require('ffi')
    const path = require('path')

    let libccurlPath = path.join(__dirname, 'ccurl')
    let is64BitOS = false
    if (process.platform === 'win32') {
      is64BitOS = ((process.arch === 'x64') || (process.env.PROCESSOR_ARCHITECTURE === 'AMD64') || process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432'))
    }
    else {
      is64BitOS = (process.arch === 'x64')
    }
    if (process.platform === 'win32') {
      libccurlPath = path.join(libccurlPath, ('win' + (is64BitOS ? '64' : '32')))
    }
    else if (process.platform == 'darwin') {
      libccurlPath = path.join(libccurlPath, 'mac')
    }
    else {
      libccurlPath = path.join(libccurlPath, ('lin' + (is64BitOS ? '64' : '32')))
    }
    libccurlPath = path.join(libccurlPath, 'libccurl')

    try {
      // Define libccurl to be used for finding the nonce
      curl = ffi.Library(libccurlPath, {
        ccurl_pow: [ 'string', [ 'string', 'int'] ],
        ccurl_pow_finalize: [ 'void', [] ],
        ccurl_pow_interrupt: [ 'void', [] ]
      })

      if ((!curl.hasOwnProperty('ccurl_pow')) || (!curl.hasOwnProperty('ccurl_pow_finalize')) || (!curl.hasOwnProperty('ccurl_pow_interrupt'))) {
        throw new Error('Could not load hashing library.')
      }
      console.log('curl library loaded')
    }
    catch (err) {
      console.log(err.message ? err.message : err)
      curl = null
    }
  }
  if (webgl2) {
    if (curl) curl.init() // must call init
    else console.log('FATAL Error on curl')
  }
  else {
    console.log('curl native without init') // will be done in localPow
  }
}

// adapted from https://github.com/iotaledger/wallet/blob/master/ui/js/iota.lightwallet.js
const localAttachToTangle = function (trunkTransaction, branchTransaction, minWeightMagnitude, trytes, callback) {
  const ccurlHashing = function (trunkTransaction, branchTransaction, minWeightMagnitude, trytes, callback) {
    const iotaObj = iota

    // inputValidator: Check if correct hash
    if (!iotaObj.valid.isHash(trunkTransaction)) {
      return callback(new Error('Invalid trunkTransaction'))
    }

    // inputValidator: Check if correct hash
    if (!iotaObj.valid.isHash(branchTransaction)) {
      return callback(new Error('Invalid branchTransaction'))
    }

    // inputValidator: Check if int
    if (!iotaObj.valid.isValue(minWeightMagnitude)) {
      return callback(new Error('Invalid minWeightMagnitude'))
    }

    var finalBundleTrytes = []
    var previousTxHash
    var i = 0

    function loopTrytes () {
      getBundleTrytes(trytes[i], function (error) {
        if (error) {
          return callback(error)
        }
        else {
          i++
          if (i < trytes.length) {
            loopTrytes()
          }
          else {
            // reverse the order so that it's ascending from currentIndex
            return callback(null, finalBundleTrytes.reverse())
          }
        }
      })
    }

    function getBundleTrytes (thisTrytes, callback) {
      // PROCESS LOGIC:
      // Start with last index transaction
      // Assign it the trunk / branch which the user has supplied
      // IF there is a bundle, chain  the bundle transactions via
      // trunkTransaction together

      var txObject = iotaObj.utils.transactionObject(thisTrytes)
      txObject.tag = txObject.obsoleteTag
      txObject.attachmentTimestamp = Date.now()
      txObject.attachmentTimestampLowerBound = 0
      txObject.attachmentTimestampUpperBound = MAX_TIMESTAMP_VALUE
      // If this is the first transaction, to be processed
      // Make sure that it's the last in the bundle and then
      // assign it the supplied trunk and branch transactions
      if (!previousTxHash) {
        // Check if last transaction in the bundle
        if (txObject.lastIndex !== txObject.currentIndex) {
          return callback(new Error('Wrong bundle order. The bundle should be ordered in descending order from currentIndex'))
        }

        txObject.trunkTransaction = trunkTransaction
        txObject.branchTransaction = branchTransaction
      }
      else {
        // Chain the bundle together via the trunkTransaction (previous tx in the bundle)
        // Assign the supplied trunkTransaciton as branchTransaction
        txObject.trunkTransaction = previousTxHash
        txObject.branchTransaction = trunkTransaction
      }

      var newTrytes = iotaObj.utils.transactionTrytes(txObject)

      // cCurl updates the nonce as well as the transaction hash
      curl.ccurl_pow.async(
        newTrytes,
        minWeightMagnitude,
        function (error, returnedTrytes) {
          if (error) {
            return callback(error)
          }
          else if (returnedTrytes == null) {
            return callback('Interrupted')
          }

          let newTxObject = iotaTools.utils.transactionObject(returnedTrytes)

          // Assign the previousTxHash to this tx
          let txHash = newTxObject.hash
          previousTxHash = txHash

          finalBundleTrytes.push(returnedTrytes)

          return callback(null)
        }
      )

      // curl.pow({trytes: newTrytes, minWeight: minWeightMagnitude}).then(function(nonce) {
      //     var returnedTrytes = newTrytes.substr(0, 2673-81).concat(nonce);
      //     var newTxObject= iotaObj.utils.transactionObject(returnedTrytes);
      //
      //     // Assign the previousTxHash to this tx
      //     var txHash = newTxObject.hash;
      //     previousTxHash = txHash;
      //
      //     finalBundleTrytes.push(returnedTrytes);
      //     callback(null);
      // }).catch(callback);
    }
    loopTrytes()
  }

  ccurlHashing(trunkTransaction, branchTransaction, minWeightMagnitude, trytes, function (error, success) {
    if (error) {
      console.log(error)
    }
    else {
      console.log(success)
    }
    if (callback) {
      return callback(error, success)
    }
    else {
      return success
    }
  })
}

// adapted from https://github.com/iotaledger/wallet/blob/master/ui/js/iota.lightwallet.js
const webglAttachToTangle = function (trunkTransaction, branchTransaction, minWeightMagnitude, trytes, callback) {
  const ccurlHashing = function (trunkTransaction, branchTransaction, minWeightMagnitude, trytes, callback) {
    const iotaObj = iota

    // inputValidator: Check if correct hash
    if (!iotaObj.valid.isHash(trunkTransaction)) {
      return callback(new Error('Invalid trunkTransaction'))
    }

    // inputValidator: Check if correct hash
    if (!iotaObj.valid.isHash(branchTransaction)) {
      return callback(new Error('Invalid branchTransaction'))
    }

    // inputValidator: Check if int
    if (!iotaObj.valid.isValue(minWeightMagnitude)) {
      return callback(new Error('Invalid minWeightMagnitude'))
    }

    var finalBundleTrytes = []
    var previousTxHash
    var i = 0

    function loopTrytes () {
      getBundleTrytes(trytes[i], function (error) {
        if (error) {
          return callback(error)
        }
        else {
          i++
          if (i < trytes.length) {
            loopTrytes()
          }
          else {
            // reverse the order so that it's ascending from currentIndex
            return callback(null, finalBundleTrytes.reverse())
          }
        }
      })
    }

    function getBundleTrytes (thisTrytes, callback) {
      // PROCESS LOGIC:
      // Start with last index transaction
      // Assign it the trunk / branch which the user has supplied
      // IF there is a bundle, chain  the bundle transactions via
      // trunkTransaction together

      var txObject = iotaObj.utils.transactionObject(thisTrytes)
      txObject.tag = txObject.obsoleteTag
      txObject.attachmentTimestamp = Date.now()
      txObject.attachmentTimestampLowerBound = 0
      txObject.attachmentTimestampUpperBound = MAX_TIMESTAMP_VALUE
      // If this is the first transaction, to be processed
      // Make sure that it's the last in the bundle and then
      // assign it the supplied trunk and branch transactions
      if (!previousTxHash) {
        // Check if last transaction in the bundle
        if (txObject.lastIndex !== txObject.currentIndex) {
          return callback(new Error('Wrong bundle order. The bundle should be ordered in descending order from currentIndex'))
        }

        txObject.trunkTransaction = trunkTransaction
        txObject.branchTransaction = branchTransaction
      }
      else {
        // Chain the bundle together via the trunkTransaction (previous tx in the bundle)
        // Assign the supplied trunkTransaciton as branchTransaction
        txObject.trunkTransaction = previousTxHash
        txObject.branchTransaction = trunkTransaction
      }

      var newTrytes = iotaObj.utils.transactionTrytes(txObject)

      curl.pow({trytes: newTrytes, minWeight: minWeightMagnitude}).then(function (nonce) {
        var returnedTrytes = newTrytes.substr(0, 2673 - 81).concat(nonce)
        var newTxObject = iotaObj.utils.transactionObject(returnedTrytes)

        // Assign the previousTxHash to this tx
        var txHash = newTxObject.hash
        previousTxHash = txHash

        finalBundleTrytes.push(returnedTrytes)
        callback(null)
      }).catch(callback)
    }
    loopTrytes()
  }

  ccurlHashing(trunkTransaction, branchTransaction, minWeightMagnitude, trytes, function (error, success) {
    if (error) {
      console.log(error)
    }
    else {
      console.log(success)
    }
    if (callback) {
      return callback(error, success)
    }
    else {
      return success
    }
  })
}

/**
 *   Prepare transfer - create bundle
**/
async function createBundle (amount, address, message, tag) {
  return new Promise(
    function (resolve, reject) {
      if (!message || message === '') {
        // take from config if empty
        message = iota.utils.toTrytes(config.message)
      }
      else {
        if (!iota.valid.isTrytes(message)) {
          message = iota.utils.toTrytes(message)
        }
      }
      if (!tag || tag === '' || !iota.valid.isTrytes(tag, 27)) {
        tag = config.tag
      }
      var transfersArray = [{ 'address': address, 'value': amount, message: message, tag: tag}]
      console.log(transfersArray)
      iota.api.prepareTransfers(seed, transfersArray, function (error, success) {
        if (error) {
          reject(error)
        }
        else {
          resolve(success)
        }
      })
    }
  )
}
/**
 *   check for correct bundle creation
 *   - bundle is arrayOfTrytes and ready for attaching to tangle
**/
async function isCorrectBundle (bundle) {
  return new Promise(
    function (resolve, reject) {
      if (!iota.valid.isArrayOfTrytes(bundle)) {
        reject()
      }
      else {
        resolve(bundle)
      }
    }
  )
}

/**
 *   do client-side pow - by sending the trytes bundle (usually server generated) which triggers attachToTangle
**/
async function attachBundle (bundle) {
  return new Promise(
    function (resolve, reject) {
      iota.api.sendTrytes(bundle, 5, 14, function (error, success) {
        if (error) {
          reject(error)
        }
        else {
          resolve(success)
        }
      }
      )
    }
  )
}

/**
 *   Gets balance for given seed
 *
 *   @param {string} seed
 *   @returns {amount} the seed's balance
 **/
async function getBalance (seed) {
  return new Promise(
    function (resolve, reject) {
      iota.api.getInputs(seed, function (error, success) {
        if (error) {
          reject(error)
        }
        else {
          resolve(success)
        }
      }
      )
    }
  )
}

/**
*   Generates as many IOTA addresses as you need

*   @param {string} seed
*   @param {int} amount //how many do you need
*   @param {int} index //on which adress to start
*   @returns {array}
**/
async function createAddresses (seed, amount, index) {
  return new Promise(
    function (resolve, reject) {
      if (index == undefined) {
        // start with 0
        index = 0
      }
      iota.api.getNewAddress(seed, {'index': index, 'checksum': true, 'total': amount, 'security': config.addressSecurityLevel, 'returnAll': true},
        function (error, success) {
          if (error) {
            reject(error)
          }
          else {
            resolve(success)
          }
        }
      )
    }
  )
}
/**
*   Sends IOTA to a given address
*
*   @param {string} address
*   @param {int} amount
*   @returns {bool}
**/
async function sendIOTA (address, amount, message, tag) {
  return new Promise(function (resolve, reject) {
    if (!message || message === '') {
    // take from config if empty
      message = iota.utils.toTrytes(config.message)
    }
    else {
      if (!iota.valid.isTrytes(message)) {
        message = iota.utils.toTrytes(message)
      }
    }
    if (!tag || tag === '' || !iota.valid.isTrytes(tag, 27)) {
      tag = config.tag
    }
    var transfers = [{ 'address': address, 'value': amount, message: message, tag: tag}]
    console.log('START')
    // curlProvider is set
    iota.api.sendTransfer(seed, depth, minWeightMagnitude, transfers,
      function (error, success) {
        console.log('callback sendTransfer reached')
        if (error) {
          reject(error)
          console.log('error while sending IOTA')
          console.log(error)
        }
        else {
          console.log('successfully sent IOTA')
          resolve(success)
        }
      }
    )

    // if (webgl2) {
    //   curlProvider.curl.init() // webgl2 based
    //   var depth = 5 // depth for tip selection algo
    //   var minWeightMagnitude = 14
    //   var transfers = [{ 'address': address, 'value': amount , message: 'IOTATIPS', tag: ''}]
    //   iota.api.sendTransfer(seed, depth, minWeightMagnitude, transfers,
    //       function(error, success)
    //       {
    //           console.log('callback sendTransfer reached')
    //           if (error)
    //           {  reject(error)
    //               console.log('error while sending IOTA')
    //               console.log(error)
    //           }
    //           else
    //           {
    //               resolve(success)
    //               console.log('successfully sent IOTA')
    //           }
    //       } )
    // }
    // else {
    //   console.log('sending IOTA: no webgl2 support found')
    //   // do local pow in nodeJS
    //   if (isNode()) {
    //     console.log('sending IOTA: try local pow in nodeJS')
    //
    //   }
    //   // reject(Error('error while sending IOTA: no webgl2 support found'));
    // }
  })
}

module.exports = {
  initClient,
  initServer,
  getBalance,
  createAddresses,
  createBundle,
  isCorrectBundle,
  attachBundle,
  sendIOTA
}
