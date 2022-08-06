function Item(name, auctionID, price, rarity, enchants, hpbs, fpbs, recomb, artofwar, stars, gemstones, id, category, profit, percentProfit, lbin, sales, lore) {
    this.itemData = {
        "name": name,
        "id": id,
        "stars": stars,
        "rarity": rarity,
        "recomb": recomb,
        "enchants": enchants,
        "hpbs": hpbs,
        "fpbs": fpbs,
        "gemstones": gemstones,
        "aow": artofwar,
        "lore": lore
    }
    this.auctionData = {
        "auctionID": auctionID,
        "category": category,
        "sales": sales,
        "price": price,
        "profit": profit,
        "percentProfit": percentProfit,
        "lbin": lbin
    }
}

module.exports = {
    Item
}