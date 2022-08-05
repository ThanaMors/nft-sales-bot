const web3 = require("./web3.js");

module.exports = async function (event) {
  let contractAddress;
  let total = 0;
  let tokenId;
  if (event.consideration[0].itemType === "2") {
    total = Number(web3.utils.fromWei(event.offer[0].amount, "ether"));
    tokenId = event.consideration[0].identifier.toString();
    contractAddress = event.consideration[0].token;
  } else {
    event.consideration.forEach((con) => {
      let eachConsideration = Number(web3.utils.fromWei(con.amount, "ether"));
      total += eachConsideration;
      tokenId = saleLog.offer[0].identifier;
    });
    contractAddress = event.consideration[0].token;
  }
};
