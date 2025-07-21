const {SlashCommandBuilder} = require('@discordjs/builders');
const schedule = require("node-schedule");
const fs = require("fs")
const achievement=require("./achievement")

let xGuaranted = fs.existsSync(__dirname + "/../X.guaranted")
let secGuaranted = fs.existsSync(__dirname + "/../sec.guaranted")


const data = new SlashCommandBuilder()
    .setName('gacha')
    .setDescription('Commandes liées au gacha')
    .addSubcommand(subcommand =>
        subcommand
            .setName('probas')
            .setDescription('Affiche les probabilités'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('x1')
            .setDescription('Tirez une carte au hasard ! (20 coquillages)'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('x10')
            .setDescription('Tirez 10 cartes d\'un coup ! (200 coquillages)'))

module.exports.data = data;

const db = require("../db")
const rarity = require("../rarity.json")

//récupération de la collection en cours
let guarantedCollec = ""
db.select("SELECT * FROM COLLECTIONS WHERE PROBAUP > 0 ORDER BY PROBAUP DESC LIMIT 1", (res) => {
    if (res.length)
        guarantedCollec = res[0].SHORT
    console.log("Guaranted collection: " + guarantedCollec)
});
schedule.scheduleJob('0 4 * * 1', async () => {
    db.select("SELECT * FROM COLLECTIONS WHERE PROBAUP > 0 ORDER BY PROBAUP DESC LIMIT 1", (res) => {
        if (res.length)
            guarantedCollec = res[0].SHORT
        console.log("Guaranted collection: " + guarantedCollec)
    });
})

const {MessageEmbed, MessageAttachment} = require("discord.js");
const {toFileString, setEmbedColor} = require("./util");

const showProbas = async function (interaction) {
    let txt = "";
    let cardsUp = await db.select("SELECT NAME,PROBAUP FROM CARDS WHERE PROBAUP NOT NULL", (res) => {
        return res
    });
    db.select("SELECT * FROM PLAYERS WHERE ID='" + interaction.user.id + "'", async (res) => {
        for (let [r, i] of Object.entries(rarity)) {
            txt += r + " - " + i.proba + "%\n"
        }
        if (cardsUp) {
            for (const card of cardsUp) {
                if (card.PROBAUP != 0) txt += "\n" + card.NAME + " - " + card.PROBAUP + "%"
            }
        }
        if (res.length == 1) {
            txt += "\nX garantie : " + (80 - res[0].PITYX) + " tir" + (res[0].PITYX != 99 ? "s" : "") +
                "\nS garantie : " + (12 - res[0].PITYS) + " tir" + (res[0].PITYS != 9 ? "s" : "")

            txt += `\n\nCarte de fidélité : ${res[0].LOYALTYCARD} point${(res[0].LOYALTYCARD>1?'s':'')}`

            let probaF=await db.select("SELECT PROBAF FROM GLOBAL",(res)=>{return res[0].PROBAF})
            txt+=`\nProbabilité de F : ${probaF/100}%`
        }
        let embed = new MessageEmbed().setTitle("Probabilité par rareté").setDescription(txt);
        interaction.editReply({embeds: [embed]})
    })
}

module.exports.showProbas = showProbas

const basePrice = 20;
const specialCollec = "";
const onlySecret = ["PM","SAKE"];

const checkGacha = async function (interaction) {
    let user = interaction.user;
    let nbDraw = parseInt(interaction.options.getSubcommand().substring(1))
    let sql = "SELECT * FROM PLAYERS WHERE ID='" + user.id + "'"
    await db.select(sql, (res) => {
        if (res.length == 0) return interaction.editReply("Impossible de trouver le compte.")
        let player = res[0];
        if (player.SEASNAILS < basePrice * nbDraw) return interaction.editReply("Tu n'as pas assez de coquillages pour tirer autant de cartes !")
        player.price = basePrice * nbDraw
        playGacha(interaction, player)
    })
}

const playGacha = async function (interaction, player, forcedRarity = "") {
    let achToCheck=[]
    if (forcedRarity)achToCheck.push("BM")

    let nbDrawInit = interaction.options.getSubcommand().substring(1);
    let nbDraw;
    (nbDrawInit == "acha" ? nbDraw = 1 : nbDraw = parseInt(nbDrawInit))

    let probaF=await db.select("SELECT PROBAF FROM GLOBAL",(res)=>{return res[0].PROBAF})

    let chaosStatus = ""
    let chaosRand = Math.floor(Math.random() * 10000)
    if (chaosRand < 100) {
        player.price = 0
        chaosStatus = "free"
    } else if (chaosRand < 110 && nbDraw==10){
        chaosStatus = "rare"
        achToCheck.push("RAREMULTIPLE")
    } else if (chaosRand < 110+probaF) {
        chaosStatus = "busted"
        db.update(`UPDATE GLOBAL SET PROBAF=100`,()=>{})
        achToCheck.push("RARITYF")
        if(nbDraw==10)achToCheck.push("RARITYF10")
        if(forcedRarity){
            achToCheck.push("BMF")
            if(player.price==600)achToCheck.push("BM600F")
        }
    } else if (!forcedRarity) {
        let loyaltyRand = Math.floor(Math.random() * 1000)
        if (loyaltyRand < player.LOYALTYCARD) {
            player.price = 0
            player.LOYALTYCARD = 0
            chaosStatus = "loyalty"
            achToCheck.push("FIDELITE")
        }
    }

    if(chaosStatus!="busted")
        db.update(`UPDATE GLOBAL SET PROBAF=PROBAF+${nbDraw*4}`,()=>{})

    for (let [r, i] of Object.entries(rarity)) {
        i.probaup = {}
        i.cards = []
    }
    db.select("SELECT co.NAME as COLLECNAME, co.PROBAUP as cpu, * FROM COLLECTIONS co,CARDS ca where ca.COLLECTION=co.SHORT", async (cardsDB) => {
        let cards = {}
        let collections = {}
        for (const c of cardsDB) {
            if (!collections[c.COLLECTION]) collections[c.COLLECTION] = {"PROBAUP": c.cpu}
            if (!collections[c.COLLECTION][c.RARITY]) collections[c.COLLECTION][c.RARITY] = []

            if (c.PROBAUP) {
                rarity[c.RARITY].probaup[c.ID] = c.PROBAUP;
            } else if (c.OBTAINABLE) {
                rarity[c.RARITY].cards.push(c.ID)
                collections[c.COLLECTION][c.RARITY].push(c.ID)
            }
            cards[c.ID] = c
        }
        let allCards = []
        for (let i = 0; i < nbDraw; i++) {
            let rarityDraw;
            let collecDraw;
            if(chaosStatus=="busted"){
                forcedRarity="F"
                rarityDraw="F"
                collecDraw="FAKE"
            } else if (secGuaranted) {
                secGuaranted = false
                fs.unlinkSync(__dirname + "/../sec.guaranted")
                rarityDraw = "✰";
                collecDraw = "SONV"
            } else if (xGuaranted) {
                xGuaranted = false
                fs.unlinkSync(__dirname + "/../X.guaranted")
                rarityDraw = "X";
                player.PITYX = -1;
                collecDraw = guarantedCollec
            } else if (player.PITYX >= 69) {
                rarityDraw = "X";
                player.PITYX = -1;
                collecDraw = guarantedCollec
                achToCheck.push("OBTAINPITYX")
            } else if (player.PITYS >= 11) {
                rarityDraw = "S"
                player.PITYS = -1;
                collecDraw = guarantedCollec
                achToCheck.push("OBTAINPITYS")
            } else {

                if (forcedRarity) {
                    rarityDraw = forcedRarity
                }else{
                    let randRarity = Math.floor(Math.random() * 100)
                    if(chaosStatus=="rare"){
                        if(i==9)rarityDraw="✰"
                        else if(randRarity<65)rarityDraw="S"
                        else if(randRarity<95)rarityDraw="X"
                        else rarityDraw="✰"
                    }else{
                        let currentRarityProba = 0
                        for (const [r, i] of Object.entries(rarity)) {
                            currentRarityProba += i.proba
                            if (randRarity < currentRarityProba) {
                                rarityDraw = r
                                break
                            }
                        }
                        if (rarityDraw == "X") {
                            player.PITYX = -1
                        } else if (rarityDraw == "S") {
                            player.PITYS = -1
                        }
                    }


                }


                if(forcedRarity || chaosStatus=="rare"){
                    let collecKeys=Object.keys(collections)
                    collecKeys.splice(collecKeys.indexOf("FAKE"),1)
                    if(rarityDraw!="✰")collecKeys.splice(collecKeys.indexOf("PM"),1)
                    if(rarityDraw=="✰")collecKeys.splice(collecKeys.indexOf("SO"),1)
                    if(rarityDraw!="✰")collecKeys.splice(collecKeys.indexOf("SAKE"),1)
                    let randCollec = Math.floor(Math.random() * collecKeys.length)
                    collecDraw=collecKeys[randCollec]
                }else{
                    let randPM = Math.floor(Math.random() * 100)

                    //COLLEC SPECIALE
                    if(randPM<0){
                        collecDraw=specialCollec
                        rarityDraw="✰"
                    }
                    else{
                        let randCollec = Math.floor(Math.random() * 100)
                        let probaupColl = ["", 0]
                        let otherColl = []
                        for (const [co, p] of Object.entries(collections)) {
                            if (p["PROBAUP"])
                                probaupColl = [co, p["PROBAUP"]]
                            else if (co != "FAKE" && co != specialCollec)
                                otherColl.push(co)
                        }
                        if (randCollec < probaupColl[1]) {
                            collecDraw = probaupColl[0]
                        } else {
                            randCollec = Math.floor(randCollec * otherColl.length / 100)
                            collecDraw = otherColl[randCollec]
                        }

                        if(onlySecret.includes(collecDraw))
                            rarityDraw="✰"

                    }
                }
            }
            if (!forcedRarity) {
                player.PITYX++
                player.PITYS++
            }
            if(!chaosStatus){
                player.LOYALTYCARD++
            }

            if(rarityDraw=="✰" && collecDraw!=specialCollec)achToCheck.push("MULTIPLE10SEC")
            if(!achToCheck.includes(`COLLEC${collecDraw}`) && rarityDraw!="F" && collecDraw!=specialCollec)achToCheck.push(`COLLEC${collecDraw}`)

            let randCard = Math.floor(Math.random() * 100)
            let currentCardProba = 0;
            let cardDraw;
            for (const [c, p] of Object.entries(rarity[rarityDraw].probaup)) {
                currentCardProba += p;
                if (randCard < currentCardProba) {
                    cardDraw = c;
                    break;
                }
            }

            if (randCard >= currentCardProba) {
                if (collections[collecDraw][rarityDraw].length) {
                    randCard = Math.floor(randCard * collections[collecDraw][rarityDraw].length / 100)
                    cardDraw = collections[collecDraw][rarityDraw][randCard]
                } else {
                    randCard = Math.floor(randCard * rarity[rarityDraw].cards.length / 100)
                    cardDraw = rarity[rarityDraw].cards[randCard]
                }
            }
            allCards.push(cardDraw)
        }
        await saveAndShowGacha(interaction, player, allCards, cards, chaosStatus)
        achToCheck=achToCheck.concat(["CARDS","MULTIPLE","LEVEL","RARITY","SEASNAILS"])
        achievement.checkAchievementsToGive(interaction.guild,interaction.user,achToCheck)
    });

}

const chaosResponse = {
    "busted": "",
    "free": "Au fait, ce tirage ne t'as rien coûté ! Cadeau !",
    "loyalty": "Grâce à ta carte de fidélité, ce tirage était gratuit !"
}

const saveAndShowGacha = async function (interaction, player, allCards, cards, chaosStatus) {
    let user = interaction.user
    let sql = "SELECT * FROM INVENTORY WHERE PLAYERID='" + user.id + "'"
    await db.select(sql, async (res) => {
        player.inventory = {}
        for (const r of res) {
            player.inventory[r.ID] = r
        }
        let embeds = []
        let attachments = []
        for (let i = 0; i < allCards.length; i++) {
            let cardDraw = allCards[i]
            let [embed, attachment] = await addCardToInventory(user, cards[cardDraw], chaosStatus)
            embeds.push(embed)
            attachments.push(attachment)
        }
        await interaction.editReply({embeds: [embeds[0]], files: [attachments[0]]})
        for (let i = 1; i < embeds.length; i++) {
            await interaction.followUp({embeds: [embeds[i]], files: [attachments[i]]})
        }
        if (chaosStatus && chaosResponse[chaosStatus]) await interaction.followUp(chaosResponse[chaosStatus])
        await db.update(`UPDATE PLAYERS SET SEASNAILS=SEASNAILS- ${player.price} ,PITYX= ${player.PITYX} ,PITYS= ${player.PITYS}, LOYALTYCARD=${player.LOYALTYCARD} WHERE ID='${user.id}'`)
    });
}

const addCardToInventory = async function (user, cardinfo, chaosStatus) {
    let sql = "SELECT * FROM INVENTORY WHERE PLAYERID='" + user.id + "' AND CARDID='" + cardinfo.ID + "'"
    let rarityinfo = rarity[cardinfo.RARITY]
    let cardname = cardinfo.NAME
    let cardtitle = cardinfo.TITLE
    let cardcollec = cardinfo.COLLECTION
    let cardid = cardinfo.ID
    let cardnumber = cardinfo.NUMBER
    let compensation=rarityinfo.compensation
    let cardmax=(cardinfo.MAX<10?"0"+cardinfo.MAX:cardinfo.MAX)

    if(onlySecret.includes(cardcollec) || cardcollec==specialCollec)compensation=10

    let ret = await db.select(sql, async (res) => {
        if (res.length == 0) {
            let sql = `INSERT INTO INVENTORY (PLAYERID, CARDID, QUANTITY) VALUES ('${user.id}','${cardinfo.ID}', 1)`
            await db.insert(sql, () => {
            })

            let file = toFileString(__dirname + "/../img/" + cardcollec + "_" + cardnumber + "_level1.png")
            let name = toFileString(cardname + ".png")
            let attachement = new MessageAttachment(file, name)
            let embed = new MessageEmbed()
                .setTitle(cardinfo.NAME)
                .setDescription(`*${cardtitle}*`+
                    "\n\n**NOUVELLE CARTE !**" +
                    "\n__**" + cardinfo.COLLECNAME + "**__ - n° " + cardnumber + "/" + cardmax +
                    "\n**" + cardinfo.RARITY + "**" +
                    (cardinfo.RARITY != "✰" ? "\nNiveau 1 " + (cardinfo.RARITY == "C" ? "(max)" : "0/" + rarityinfo.tonextlv) : ""))
                .setImage("attachment://" + name)
            embed=setEmbedColor(cardinfo.RARITY, embed)
            return [embed, attachement]
        } else {
            if (res[0].CARDLEVEL == rarityinfo.maxlv) {
                if (chaosStatus != "busted") {
                    let sql = "UPDATE PLAYERS SET SEASNAILS=SEASNAILS+" + compensation + " WHERE ID='" + user.id + "'";
                    await db.update(sql, () => {
                    })
                }
                sql = `UPDATE INVENTORY
                       SET QUANTITY=QUANTITY + 1
                       WHERE CARDID = ${cardinfo.ID}
                         and PLAYERID = "${user.id}"`
                await db.update(sql, () => {
                })
                let cardname = cardinfo.NAME
                let file = toFileString(__dirname + "/../img/" + cardcollec + "_" + cardnumber + "_level" + res[0].CARDLEVEL + ".png")
                let name = toFileString(cardname + ".png")
                let attachement = new MessageAttachment(file, name)
                let embed = new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription(`*${cardtitle}*`+
                        "\n\n__**" + cardinfo.COLLECNAME + "**__ - n° " + cardnumber + "/" + cardmax +
                        "\n**" + cardinfo.RARITY + "**" +
                        (cardinfo.RARITY != "✰" ? "\nNiveau " + res[0].CARDLEVEL + " (max)" : "") +
                        (chaosStatus == "busted" ? "" : "\n*Compensation : " + compensation + " coquillage" + (rarityinfo.compensation == 1 ? "*" : "s*")))
                    .setImage("attachment://" + name)
                embed=setEmbedColor(cardinfo.RARITY, embed)
                return [embed, attachement]
            } else if ((res[0].NBPOSSESSED + 1) == rarityinfo.tonextlv) {
                let newlv = res[0].CARDLEVEL + 1
                let sql = "UPDATE INVENTORY SET CARDLEVEL=" + newlv + ", NBPOSSESSED=0, QUANTITY=QUANTITY+1 WHERE PLAYERID='" + user.id + "' AND CARDID='" + cardid + "'"
                await db.update(sql, () => {
                })

                let cardname = cardinfo.NAME
                let file = toFileString(__dirname + "/../img/" + cardcollec + "_" + cardnumber + "_level" + newlv + ".png")
                let name = toFileString(cardname + ".png")
                let attachement = new MessageAttachment(file, name)
                let embed = new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription(`*${cardtitle}*`+
                        "\n\n**NIVEAU SUP !**" +
                        "\n__**" + cardinfo.COLLECNAME + "**__ - n° " + cardnumber + "/" + cardmax +
                        "\n**" + cardinfo.RARITY + "**" +
                        (cardinfo.RARITY != "✰" ? "\nNiveau " + newlv + (newlv == rarityinfo.maxlv ? " (max)" : " 0/" + rarityinfo.tonextlv) : ""))
                    .setImage("attachment://" + name)
                embed=setEmbedColor(cardinfo.RARITY, embed)
                return [embed, attachement]
            } else {
                let sql = "UPDATE INVENTORY SET NBPOSSESSED=NBPOSSESSED+1, QUANTITY=QUANTITY+1 WHERE PLAYERID='" + user.id + "' AND CARDID='" + cardinfo.ID + "'"
                await db.update(sql, () => {
                })

                let cardname = cardinfo.NAME
                let file = toFileString(__dirname + "/../img/" + cardcollec + "_" + cardnumber + "_level" + res[0].CARDLEVEL + ".png")
                let name = toFileString(cardname + ".png")
                let attachement = new MessageAttachment(file, name)
                let embed = new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription(`*${cardtitle}*`+
                        "\n\n__**" + cardinfo.COLLECNAME + "**__ - n° " + cardnumber + "/" + cardmax +
                        "\n**" + cardinfo.RARITY + "**" +
                        (cardinfo.RARITY != "✰" ? "\nNiveau " + res[0].CARDLEVEL + " " + (res[0].NBPOSSESSED + 1) + "/" + rarityinfo.tonextlv : ""))
                    .setImage("attachment://" + name)
                embed=setEmbedColor(cardinfo.RARITY, embed)
                return [embed, attachement]
            }
        }
    })
    return ret
}

module.exports.checkGacha = checkGacha
module.exports.playGacha = playGacha