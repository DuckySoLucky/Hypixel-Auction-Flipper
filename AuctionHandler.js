const {default: axios} = require("axios");
const {getParsed, getProfit, splitNumber, getRawCraft} = require("./src/helperFunctions");
const {parentPort, workerData} = require("worker_threads");
const config = require("./config.json")
let minProfit = config.data.minSnipeProfit
let minPercentProfit = config.data.minSnipePP
let ignoredAuctions = []
const {Item} = require("./src/Item")
const threadsToUse = require("./config.json").data["threadsToUse/speed"]
const promises = []

parentPort.on("message", async (message) => {
    if (message.type === "pageCount") {
        await doTask(message.data)
    } else if (message.type === "moulberry") {
        workerData.itemDatas = message.data
    }
})

async function parsePage(i) {
    const auctionPage = await axios.get(`https://api.hypixel.net/skyblock/auctions?page=${i}`)
    for (const auction of auctionPage.data.auctions) {
        if (!auction.bin) continue
        const uuid = auction.uuid
        if (ignoredAuctions.includes(uuid) || config.data.ignoreCategories[auction.category]) continue
        const item = await getParsed(auction.item_bytes)
        const extraAtt = item["i"][0].tag.ExtraAttributes
        const itemID = extraAtt.id
        let startingBid = auction.starting_bid
        const itemData = workerData.itemDatas[itemID]
        if (!itemData) continue
        const lbin = itemData.lbin
        const sales = itemData.sales
        const prettyItem = new Item(item.i[0].tag.display.Name, uuid, startingBid, auction.tier, extraAtt.enchantments,
            extraAtt.hot_potato_count > 10 ? 10 : extraAtt.hot_potato_count, extraAtt.hot_potato_count > 10 ?
                extraAtt.hot_potato_count - 10 : 0, extraAtt.rarity_upgrades === 1,
            extraAtt.art_of_war_count === 1, extraAtt.dungeon_item_level,
            extraAtt.gems, itemID, auction.category, 0, 0, lbin, sales, auction.item_lore)
        const unstableOrMarketManipulated = Math.abs((lbin - itemData.cleanPrice) / lbin) > config.data.maxAvgLbinDiff
        ignoredAuctions.push(uuid)
        const rcCost = config.data.includeCraftCost ? getRawCraft(prettyItem, workerData.bazaarData, workerData.itemDatas) : 0
        const carriedByRC = rcCost >= config.data.rawCraftMaxWeightPP * lbin

        if (carriedByRC || unstableOrMarketManipulated || sales <= config.data.minSales || !sales) continue

        if (config.filters.nameFilter.find((name) => itemID.includes(name)) === undefined) {
            if ((lbin + rcCost) - startingBid > minProfit) {
                const profitData = getProfit(startingBid, rcCost, lbin)
                let auctionType = null
                if (rcCost > (lbin - startingBid) && profitData.snipeProfit < minProfit) {
                    auctionType = "VALUE"
                } else if (profitData.snipeProfit >= minProfit && rcCost < (lbin - startingBid)) {
                    auctionType = "SNIPE"
                } else if (profitData.snipeProfit >= minProfit && rcCost > 0) {
                    auctionType = "BOTH"
                }

                prettyItem.auctionData.ahType = auctionType

                if (auctionType === "VALUE" || auctionType === "BOTH") {
                    if (profitData.RCProfit > config.data.minCraftProfit && profitData.RCPP > config.data.minCraftPP) {
                        prettyItem.auctionData.profit = profitData.RCProfit
                        prettyItem.auctionData.percentProfit = profitData.RCPP
                        parentPort.postMessage(prettyItem)
                    }
                } else {
                    if (profitData.snipeProfit > minProfit && profitData.snipePP > minPercentProfit) {
                        prettyItem.auctionData.profit = profitData.snipeProfit
                        prettyItem.auctionData.percentProfit = profitData.snipePP
                        parentPort.postMessage(prettyItem)
                    }
                }
            }
        }
    }
}

async function doTask(totalPages) {
    let startingPage = 0
    const pagePerThread = splitNumber(totalPages, threadsToUse)

    if (workerData.workerNumber !== 0 && startingPage === 0) {
        const clonedStarting = pagePerThread.slice()
        clonedStarting.splice(workerData.workerNumber, 9999);
        clonedStarting.forEach((pagePer) => {
            startingPage += pagePer
        })
    }

    let pageToStop = parseInt(startingPage) + parseInt(pagePerThread[workerData.workerNumber])

    if (pageToStop !== totalPages) {
        pageToStop -= 1
    }

    for (let i = startingPage; i < pageToStop; i++) {
        promises.push(parsePage(i))
    }
    await Promise.all(promises)
    //parentPort.postMessage("finished")
}
