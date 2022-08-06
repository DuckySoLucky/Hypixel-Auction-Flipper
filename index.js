const {default: axios} = require("axios")
const config = require("./config.json")
const discord = require('discord.js')
const {Worker} = require("worker_threads")
const { asyncInterval, addNotation } = require("./src/helperFunctions")
let threadsToUse = config.data["threadsToUse/speed"] ?? 1
let lastUpdated = 0
let doneWorkers = 0
let startingTime
let maxPrice = 0
let itemDatas = {}
const workers = []
const webhookRegex = /https:\/\/discord.com\/api\/webhooks\/(.+)\/(.+)/

const bazaarPrice = {
    "RECOMBOBULATOR_3000": 0,
    "HOT_POTATO_BOOK": 0,
    "FUMING_POTATO_BOOK": 0
}

async function initialize() {
    matches = config.webhook.discordWebhookUrl.match(webhookRegex)
    if (!matches) return console.log(`[Main thread] Couldn't parse Webhook URL`)
    const webhook = new discord.WebhookClient(matches[1], matches[2]);

    await getBzData()
    await getMoulberry()
    await getLBINs()

    for (let j = 0; j < threadsToUse; j++) {
        workers[j] = new Worker('./AuctionHandler.js', {
            workerData: {
                itemDatas: itemDatas,
                bazaarData: bazaarPrice,
                workerNumber: j,
                maxPrice: maxPrice
            }
        })

        workers[j].on("message", async (result) => {
            if (result.itemData !== undefined) {
                if (result.auctionData.lbin >= result.auctionData.price) {
                    await webhook.send({
                        username: config.webhook.webhookName,
                        avatarURL: config.webhook.webhookPFP,
                        embeds: [new discord.MessageEmbed()
                            .setTitle(`**${(result.itemData.name).replaceAll(/§./g, '')}**`)
                            .setColor("#2e3137")
                            .setThumbnail(`https://sky.shiiyu.moe/item/${result.itemData.id}`)
                            .setDescription(`Auction: \`/viewauction ${result.auctionData.auctionID}\`\nProfit: \`${addNotation("oneLetters", (result.auctionData.profit))} (${result.auctionData.percentProfit}%)\`\nCost: \`${addNotation("oneLetters", (result.auctionData.price))}\`\nLBIN: \`${addNotation("oneLetters", (result.auctionData.lbin))}\`\nSales/Day: \`${addNotation("oneLetters", result.auctionData.sales)}\`\nType: \`${result.auctionData.ahType}\``)
                        ]
                    })
                    
                }
            } else if (result === "finished") {
                doneWorkers++
                if (doneWorkers === threadsToUse) {
                    doneWorkers = 0
                    console.log(`Completed in ${(Date.now() - startingTime) / 1000} seconds`)
                    startingTime = 0
                    workers[0].emit("done")
                }
            }
        });
    }

    asyncInterval(async () => {
        await getLBINs()
        workers.forEach((worker) => {
            worker.postMessage({type: "moulberry", data: itemDatas})
        })
    }, "lbin", 60000)

    asyncInterval(async () => {
        await getMoulberry()
        workers.forEach((worker) => {
            worker.postMessage({type: "moulberry", data: itemDatas})
        })
    }, "avg", 60e5)


    asyncInterval(async () => {
        return new Promise(async (resolve) => {
            const ahFirstPage = await axios.get("https://api.hypixel.net/skyblock/auctions?page=0")
            const totalPages = ahFirstPage.data.totalPages
            if (ahFirstPage.data.lastUpdated === lastUpdated) {
                resolve()
            } else {
                lastUpdated = ahFirstPage.data.lastUpdated
                startingTime = Date.now()
                console.log("Getting auctions..")
                workers.forEach((worker) => {
                    worker.postMessage({type: "pageCount", data: totalPages})
                })
                workers[0].once("done", () => {
                    resolve()
                })
            }
        })
    }, "check", 0)
}

async function getLBINs() {
    const lbins = await axios.get("https://moulberry.codes/lowestbin.json")
    const lbinData = lbins.data
    for (const item of Object.keys(lbinData)) {
        if (!itemDatas[item]) itemDatas[item] = {}
        itemDatas[item].lbin = lbinData[item]
    }
}

async function getMoulberry() {
    const moulberryAvgs = await axios.get("https://moulberry.codes/auction_averages/3day.json")
    const avgData = moulberryAvgs.data
    for (const item of Object.keys(avgData)) {
        itemDatas[item] = {}
        const itemInfo = avgData[item]
        if (itemInfo.sales !== undefined) {
            itemDatas[item].sales = itemInfo.sales
        } else {
            itemDatas[item].sales = 0
        }
        if (itemInfo.clean_price) {
            itemDatas[item].cleanPrice = itemInfo.clean_price
        } else {
            itemDatas[item].cleanPrice = itemInfo.price
        }
    }
}

async function getBzData() {
    const bzData = await axios.get("https://api.hypixel.net/skyblock/bazaar")
    bazaarPrice["RECOMBOBULATOR_3000"] = bzData.data.products.RECOMBOBULATOR_3000.quick_status.buyPrice
    bazaarPrice["HOT_POTATO_BOOK"] = bzData.data.products.HOT_POTATO_BOOK.quick_status.buyPrice
    bazaarPrice["FUMING_POTATO_BOOK"] = bzData.data.products.FUMING_POTATO_BOOK.quick_status.buyPrice
}


initialize()
