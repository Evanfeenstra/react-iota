'use strict';

module.exports = {
  IotaProvider: require('./build/main.js').default,
  Wallet: require('./build/wallet.js').default,
  Curl: require('./build/curl.min.js'),
  WorkerCurl: require('./build/curl.worker.min.js')
}
