require("dotenv").config();
const Web3 = require("web3");
const process = require("process");
const moment = require("moment");
const config = require("./config.json");
const seaportAbi = require("./ABIs/seaportABI.json");
const looksRareABI = require("./ABIs/looksRareABI.json");
const { Client, Intents, MessageEmbed } = require("discord.js");
const fetch = require("node-fetch");
const fs = require("fs");
const nftabi = require("./ABIs/nftabi.json");

//WEB3
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

process.on("unhandledRejection", (reason, promise) => {
  console.log("Unhandled Rejection at:", promise, "reason:", reason);
});

//DISCORD CLIENT
const myIntents = new Intents();
myIntents.add("GUILDS", "GUILD_MESSAGES");
const client = new Client({ intents: myIntents });

//LOGIN TO DISCORD
client.login(process.env.DISCORD_TOKEN);

//moment time format
moment().locale("en");
moment("DD/MM/YY", "HH/MM").format();

//////////////////////////////////////
//get info from config
let addresses = [];
let names = [];
let channels = [];

let getConfigInfo = () => {
  config.forEach((obj) => {
    addresses.push(obj["address"]);
    names.push(obj["name"]);
    channels.push(obj["channel"]);
  });
};

getConfigInfo();
//turn all addresses into lowercase
let lowercaseAddresses = addresses.map((address) => {
  return address.toLowerCase();
});

//////////////////////////////////////
//DISCORD
client.on("interactionCreate", (interaction) => {
  if (!interaction.isCommand()) return;

  const accessFile = async (
    collectionName,
    address,
    channelid,
    addOrDelete
  ) => {
    let rawdata = fs.readFileSync("./config.json");
    let json = JSON.parse(rawdata);
    let isAccountThere = false;

    json.forEach((obj) => {
      if (obj.name.toLowerCase() === collectionName.toLowerCase()) {
        isAccountThere = true;
      }
    });

    if (addOrDelete === false) {
      if (isAccountThere === false) {
        json.push({
          name: collectionName,
          channel: channelid,
          address: address,
        });
        await interaction.reply(`Added: ${collectionName} `);
      } else {
        await interaction.reply(`@${collectionName} already exists!`);
      }
    } else {
      if (isAccountThere === true) {
        json = json.filter(
          (collection) =>
            collection.name.toLowerCase() != collectionName.toLowerCase()
        );
        await interaction.reply(`Deleted: ${collectionName}`);
      } else {
        await interaction.reply(`@${collectionName} doesn't exist!`);
      }
    }

    let data = JSON.stringify(json);
    fs.writeFileSync("config.json", data);
  };

  if (interaction.commandName === "add-collection") {
    let channelName = interaction.options.getString("name");
    let address = interaction.options.getString("address");
    if (
      interaction.user.id === "229031571716308992" ||
      interaction.user.id === "351236696446205964" ||
      interaction.user.id === "120713182707712001"
    ) {
      interaction.guild.channels
        .create(channelName, {
          type: "GUILD_TEXT",
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone,
            },
          ],
        })
        .then((channel) => {
          const categoryId = "959223756776149002";

          channel.setParent(categoryId);
          console.log(`Created a new channel called ${channelName}`);
          accessFile(channelName, address, channel.id, false);
        })
        .catch(console.error);
    }
  }

  if (interaction.commandName === "delete-collection") {
    let channelName = interaction.options.getString("name");
    if (
      interaction.user.id === "229031571716308992" ||
      interaction.user.id === "351236696446205964" ||
      interaction.user.id === "120713182707712001"
    ) {
      accessFile(channelName, null, null, true);
    }
  }
});

///////////////////////////////////////

//OPENSEA ADDRESS
const seaportAddress =
  "0x00000000006c3852cbEf3e08E8dF289169EdE581".toLowerCase();
//OPENSEA CONTRACT INSTANCE
let seaportContract = new web3.eth.Contract(seaportAbi, seaportAddress);

const sendInfoToDiscord = async (
  name,
  value,
  taker,
  maker,
  marketplace,
  channel,
  transactionHash,
  address,
  tokenId
) => {
  //get tx info for date
  const tx = await web3.eth.getTransaction(transactionHash);

  const turnIpfsSchemaToHttp = (image) => {
    if (image.startsWith("ipfs://")) {
      image = image.replace("ipfs://", "https://ipfs.io/ipfs/");
      return image;
    }
    return image;
  };
  //get tokenURI
  let image = "";
  let title = "";
  let nftContract = new web3.eth.Contract(nftabi, address);
  let tokenUri = await nftContract.methods.tokenURI(tokenId).call();
  console.log(tokenUri);

  if (tokenUri != undefined) image = turnIpfsSchemaToHttp(tokenUri);
  let fetchedData = await fetch(image);
  let jsonData = await fetchedData.json();

  image = turnIpfsSchemaToHttp(jsonData.image);

  if (jsonData.name != undefined) {
    title = jsonData.name;
  } else {
    title = `${name} #${tokenId}`;
  }

  let block = await web3.eth.getBlock(tx.blockNumber);
  let date;
  if (block.timestamp) {
    date = moment.unix(block.timestamp).toString();
  }

  ///show sale in console
  console.log(`Sale: ${name} on ${marketplace}`);
  console.log(transactionHash);
  console.log(`Token ID: ${tokenId}`);
  console.log(`Seller: ${maker}`);
  console.log(`Buyer: ${taker}`);
  console.log(`Price: ${value}`);
  console.log(`Date: ${date}`);
  console.log(`Channel: ${channel}\n`);

  const embedMsg = new MessageEmbed()
    .setColor("#0099ff")
    .setTitle(title)
    .setURL(`https://opensea.io/assets/${address}/${tokenId}`)
    .setDescription(`has just been sold for ${value}Ξ on ${marketplace}`)
    //.setThumbnail(data.collection.image_url)
    .setImage(image)
    .addFields({
      name: "From",
      value: `[${maker.slice(0, 8)}](https://opensea.io/${maker})`,
      inline: true,
    })
    .addFields({
      name: "To",
      value: `[${taker.slice(0, 8)}](https://opensea.io/${taker})`,
      inline: true,
    })
    .setTimestamp(date);

  try {
    client.channels
      .fetch(channel)
      .then((channel) => {
        channel.send({ embeds: [embedMsg] });
      })
      .catch(console.error);
  } catch (e) {
    console.log(e);
  }
};

const orderFulfilledCallback = (event) => {
  let contractAddress;
  let total = 0;
  let tokenId;
  let firstItemType;
  const values = event.returnValues;

  //console.log(values.consideration[0].itemType);
  try {
    firstItemType = values.consideration[0].itemType;
    //console.log(firstItemType);
    if (firstItemType && firstItemType === "2") {
      total = Number(web3.utils.fromWei(values.offer[0].amount, "ether"));
      tokenId = values.consideration[0].identifier.toString();
      contractAddress = values.consideration[0].token;
    } else {
      values.consideration.forEach((con) => {
        let eachConsideration = Number(web3.utils.fromWei(con.amount, "ether"));
        total += eachConsideration;
        tokenId = values.offer[0].identifier;
      });
      contractAddress = values.offer[0].token;
    }

    if (lowercaseAddresses.includes(contractAddress.toLowerCase())) {
      const txHash = event.transactionHash;
      const buyer = values.recipient;
      const seller = values.offerer;
      const index = lowercaseAddresses.indexOf(contractAddress.toLowerCase());
      const channel = channels[index];
      const name = names[index];

      /*
  name,
  value,
  taker,
  maker,
  marketplace,
  channel,
  transactionHash,
  address,
  tokenId 
  */
      sendInfoToDiscord(
        name,
        total.toFixed(3),
        buyer,
        seller,
        "OpenSea",
        channel,
        txHash,
        contractAddress,
        tokenId
      );
    }
  } catch (e) {
    console.log(e);
  }
};

////////////LOOKS RARE////////////////////
let looksRareAddress = "0x59728544b08ab483533076417fbbb2fd0b17ce3a";
let looksRareContract = new web3.eth.Contract(looksRareABI, looksRareAddress);

let takerBidCallback = async (sale, channel, name, address) => {
  //(name, value, taker, maker, marketplace, channel, transactionHash)\
  let txHash = sale.transactionHash;
  let txReceipt = await web3.eth.getTransactionReceipt(txHash);
  let value = web3.utils.fromWei(sale.returnValues.price);
  //buyer
  let taker = web3.utils.hexToNumberString(
    txReceipt.topics[length - 1].topics[0]
  );
  //seller
  let maker = web3.utils.hexToNumberString(
    txReceipt.topics[length - 1].topics[1]
  );
  let tokenId = sale.returnValues.tokenId;

  sendInfoToDiscord(
    name,
    value,
    taker,
    maker,
    "LooksRare",
    channel,
    txHash,
    address,
    tokenId
  );
};

const main = async () => {
  let txHashes = new Set();
  try {
    seaportContract.events.OrderFulfilled(
      {
        fromBlock: "latest",
      },
      async function (error, event) {
        if (!error) {
          let txHash = event.transactionHash;
          if (txHashes.has(txHash)) return;
          txHashes.add(txHash);
          orderFulfilledCallback(event);
          //console.log(event);
        }
      }
    );
  } catch (e) {
    console.log(e);
  }

  try {
    looksRareContract.events.TakerBid(
      { fromBlock: "latest" },
      async (error, sale) => {
        if (!error) {
          let collection = sale.returnValues.collection;
          if (lowercaseAddresses.includes(collection)) {
            let index = addresses.indexOf(collection);
            let address = addresses[index];
            let channel = channels[index];
            let name = names[index];
            await takerBidCallback(sale, channel, name, address);
          }
        }
      }
    );
  } catch (e) {
    console.log(e);
  }

  //run discord bot
  client.on("ready", () => {
    console.log("The bot is online!");
  });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
