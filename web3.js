const Web3 = require("web3");
require("dotenv").config();

let web3 = new Web3(
  new Web3.providers.WebsocketProvider(process.env.INFURA_ENDPOINT, {
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 60000,
    },
    reconnect: {
      auto: true,
      delay: 5000, // ms
      maxAttempts: 25,
      onTimeout: false,
    },
  })
);

module.exports = web3;
