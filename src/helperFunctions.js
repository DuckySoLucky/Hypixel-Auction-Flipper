const config = require('../config.json')
const nbt = require('prismarine-nbt')
let currentAsyncIntervals = {}

function addNotation(type, value) {
    let returnVal = value;
    let notList = [];
    if (type === "shortScale") {
        notList = [
            " Thousand",
            " Million",
            " Billion",
            " Trillion",
            " Quadrillion",
            " Quintillion"
        ];
    }

    if (type === "oneLetters") {
        notList = ["K", "M", "B", "T"];
    }

    let checkNum = 1000;
    if (type !== "none" && type !== "commas") {
        let notValue = notList[notList.length - 1];
        for (let u = notList.length; u >= 1; u--) {
            notValue = notList.shift();
            for (let o = 3; o >= 1; o--) {
                if (value >= checkNum) {
                    returnVal = value / (checkNum / 100);
                    returnVal = Math.floor(returnVal);
                    returnVal = (returnVal / Math.pow(10, o)) * 10;
                    returnVal = +returnVal.toFixed(o - 1) + notValue;
                }
                checkNum *= 10;
            }
        }
    } else {
        returnVal = numberWithCommas(value.toFixed(0));
    }

    return returnVal;
}

async function getParsed(encoded) {
    return new Promise((resolve) => {
        let buf = Buffer.from(encoded, 'base64');
        nbt.parse(buf, (err, dat) => {
            if (err) throw err;
            resolve(nbt.simplify(dat))
        });
    })
}

function getProfit(price, rcCost, lbin) {
    const profitItem = {}
    if (price >= 1000000) {
        profitItem.RCProfit = ((lbin + rcCost) - price)
            - ((lbin + rcCost) * 0.02);
        profitItem.RCPP = parseFloat(((profitItem.RCProfit * 100) / lbin).toFixed(1))
        profitItem.snipeProfit = (lbin - price) - (lbin * 0.02)
        profitItem.snipePP = parseFloat(((profitItem.snipeProfit * 100) / lbin).toFixed(1))
    } else {
        profitItem.RCProfit = ((lbin + rcCost) - price)
            - ((lbin + rcCost) * 0.01);
        profitItem.RCPP = parseFloat(((profitItem.RCProfit * 100) / lbin).toFixed(1))
        profitItem.snipeProfit = (lbin - price) - (lbin * 0.01)
        profitItem.snipePP = parseFloat(((profitItem.snipeProfit * 100) / lbin).toFixed(1))
    }

    return profitItem
}

function splitNumber (num = 1, parts = 1) {
    let n = Math.floor(num / parts);
    const arr = [];
    for (let i = 0; i < parts; i++){
        arr.push(n)
    }
    if(arr.reduce((a, b)=> a + b,0) === num){
        return arr;
    }
    for(let i = 0; i < parts; i++){
        arr[i]++;
        if(arr.reduce((a, b) => a + b, 0) === num){
            return arr;
        }
    }
}

function getRawCraft(item, bazaarPrice, lbins) {
    let price = 0
    const ignoreMatch = Object.keys(config.filters.rawCraftIgnoreEnchants).find((key) => {
        if (item.itemData.id.includes(key)) return true
    })
    if (item.auctionData.lbin < config.data.minPriceForRawcraft) return 0
    let isInIgnore = ignoreMatch ? ignoreMatch : false
    if (item.itemData.enchants && !item.itemData.id.includes(';')) {
        for (const enchant of Object.keys(item.itemData.enchants)) {
            const degree = item.itemData.enchants[enchant]
            const badEnchant = typeof config.filters.badEnchants[enchant] === 'number' ? degree >= config.filters.badEnchants[enchant] : false
            if (isInIgnore) {
                const enchantMinValue = config.filters.rawCraftIgnoreEnchants[ignoreMatch][enchant]
                if (enchantMinValue >= degree) continue
            }
            if (badEnchant) {
                price += lbins[`${enchant.toUpperCase()};${degree.toString()}`] ? lbins[`${enchant.toUpperCase()};${degree.toString()}`].lbin * 0.5 : 0
            }
        }
    }
    if (item.itemData.aow) {
        price += lbins['THE_ART_OF_WAR'] * 0.3
    }
    if (item.itemData.recomb && (item.auctionData.category === 'weapon' || item.auctionData.category === 'armor' || item.auctionData.category === 'accessories')) {
        price += bazaarPrice['RECOMBOBULATOR_3000'] * 0.5
    }
    price += (item.itemData.hpbs ? item.itemData.hpbs : 0) * bazaarPrice['HOT_POTATO_BOOK'] * 0.05
    price += (item.itemData.fpbs ? item.itemData.fpbs : 0) * bazaarPrice['FUMING_POTATO_BOOK'] * 0.1

    return price
}

async function asyncInterval(asyncTask, intervalname, timeout) {
    currentAsyncIntervals[intervalname] = true
    setTimeout(async function () {
        if (!currentAsyncIntervals[intervalname]) return
        asyncTask().then(async function () {
            await asyncInterval(asyncTask, intervalname, timeout)
        })
    }, timeout)
}

function stopAsyncInterval(intervalname) {
    currentAsyncIntervals[intervalname] = false
}

function currentIntervals() {
    return currentAsyncIntervals
}


module.exports = {
    addNotation,
    getParsed,
    getProfit,
    splitNumber,
    getRawCraft,
    asyncInterval,
    stopAsyncInterval,
    currentIntervals
}
