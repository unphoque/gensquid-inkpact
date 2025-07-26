const {SlashCommandBuilder} = require('@discordjs/builders');
const permissions = require("./permissions")
const secretsql = require("../secretsql.json")

const data = new SlashCommandBuilder()
    .setName('achievement')
    .setDescription('Commandes relatives aux achievements')
    .addSubcommand(subcommand =>
        subcommand
            .setName('liste')
            .setDescription('Affiche la liste des achievements avec leur ID interne'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('info')
            .setDescription('Affiche le détail d\'un achievement (nom, méthode de réalisation, progression)')
            .addStringOption(option => option.setName('id').setDescription('ID de l\'achievement (vous pouvez le trouver depuis /achievement liste)').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('give')
            .setDescription('Donne un achievement à un joueur (admin seulement)')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true))
            .addStringOption(option => option.setName('id').setDescription('ID de l\'achievement').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Retire un achievement (admin seulement)')
            .addStringOption(option => option.setName('id').setDescription('ID de l\'achievement').setRequired(true))
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur (optionnel)')))


module.exports.data = data;

const db = require("../db.js")
const {MessageEmbed} = require("discord.js");
const collections = require("../collections.json")
const {sleep} = require("./util");

const checkBin = function (achValue, myList) {
    let i = achValue.indexOf('1')
    return myList[i] == "1"
}

const setBin = function (achValue, myList) {
    let i = achValue.indexOf('1')
    myList = myList.split('')
    myList.splice(i, 1, "1")
    myList = myList.join('')
    return myList
}

const setZero = function (achValue, myList) {
    let i = achValue.indexOf('1')
    myList = myList.split('')
    myList.splice(i, 1, "0")
    myList = myList.join('')
    return myList
}

const showAchievementList = async function (interaction) {
    let user = interaction.user
    let list = await db.select("SELECT ID, NAME, SECRET, VALUE FROM ACHIEVEMENTS WHERE SECRET<2;", (res) => {
        return res
    })
    let myList = await db.select(`SELECT ACHDATA
                                  FROM PLAYERS
                                  WHERE ID = "${user.id}"`, (res) => {
        return res[0].ACHDATA
    })
    let embed = new MessageEmbed().setTitle("Liste des achievements")
    let desc = "*ID - Nom*"
    if (permissions.includes(interaction.user.id)) {
        for (const listKey in list) {
            let l = list[listKey]
            let tmp = `${l.ID} - ${l.NAME}`
            if (checkBin(l.VALUE, myList)) tmp = `**${tmp}**`
            desc += `\n${tmp}`
        }
    } else {
        for (const listKey in list) {
            let l = list[listKey]
            let tmp = `${(l.SECRET == 1 && !(checkBin(l.VALUE, myList)) ? "???" : l.ID)} - ${l.NAME}`
            if (checkBin(l.VALUE, myList)) tmp = `**${tmp}**`
            desc += `\n${tmp}`
        }
    }

    embed.setDescription(desc)
    interaction.editReply({embeds: [embed]})
}

module.exports.showAchievementList = showAchievementList

const showAchievementDetail = async function (interaction) {
    let user = interaction.user
    let achId = interaction.options.getString("id").toUpperCase()
    await db.select(`SELECT *
                     FROM ACHIEVEMENTS
                     WHERE ID = "${achId}"
                       AND SECRET < 2;`, async (res) => {
        if (res.length == 0) return interaction.editReply("L'achievement cherché n'existe pas.")
        else {
            let achievement = res[0]
            let myList = await db.select(`SELECT ACHDATA
                                          FROM PLAYERS
                                          WHERE ID = "${user.id}"`, (res) => {
                return res[0]
            })
            let embed = new MessageEmbed().setTitle(achievement.NAME)
            let desc = `${achievement.DESC}\nRécompense : ${achievement.REWARD} coquillages\n`
            if (checkBin(achievement.VALUE, myList)) {
                desc += "**COMPLÉTÉ !**"
            } else {
                let data = await checkAchievementProgress(user, achievement.ID)
                desc += data[1]
            }

            embed.setDescription(desc)
            return interaction.editReply({embeds: [embed]})

        }
    })

}

module.exports.showAchievementDetail = showAchievementDetail

const giveAchievement = async function (interaction) {
    if (!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")

    let achId = interaction.options.getString("id")
    await db.select(`SELECT *
                     FROM ACHIEVEMENTS
                     WHERE ID = "${achId}"`, async (res) => {
        if (res.length == 0) return interaction.editReply("L'achievement cherché n'existe pas.")
        let achievement = res[0]
        let joueur = interaction.options.getUser("joueur")
        let myList = await db.select(`SELECT ACHDATA
                                      FROM PLAYERS
                                      WHERE ID = "${joueur.id}"`, (res) => {
            return res[0].ACHDATA
        })
        if (checkBin(achievement.VALUE, myList)) return interaction.editReply("Le joueur possède déjà cet achievement.")

        let newList = setBin(achievement.VALUE, myList)

        await db.update(`UPDATE PLAYERS
                         SET ACHDATA="${newList}"
                         WHERE ID = "${joueur.id}"`)

        newAchievementObtained(interaction.guild, joueur, achievement)
        interaction.editReply("L'achievement a été donné avec succès.")
    })

}

module.exports.giveAchievement = giveAchievement
const removeAchievement = async function (interaction) {
    if (!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")

    let achId = interaction.options.getString("id")
    await db.select(`SELECT *
                         FROM ACHIEVEMENTS
                         WHERE ID = "${achId}"`, async (res) => {
        if (res.length == 0) return interaction.editReply("L'achievement cherché n'existe pas.")
        let achievement = res[0]
        let joueur = interaction.options.getUser("joueur")
        if (joueur){
            let myList = await db.select(`SELECT ACHDATA
                                          FROM PLAYERS
                                          WHERE ID = "${joueur.id}"`, (res) => {
                return res[0].ACHDATA
            })
            let newList = setBin(achievement.VALUE, myList)

            await db.update(`UPDATE PLAYERS
                             SET ACHDATA="${newList}"
                             WHERE ID = "${joueur.id}"`)
        }else{
            let allAchData = await db.select(`SELECT ID, ACHDATA
                                          FROM PLAYERS`, (res) => {
                return res
            })
            for (const allAchDataKey in allAchData) {
                let userid=allAchData[allAchDataKey].ID
                let myList=allAchData[allAchDataKey].ACHDATA
                let newList=setZero(achievement.VALUE,myList)
                await db.update(`UPDATE PLAYERS
                             SET ACHDATA="${newList}"
                             WHERE ID = "${userid}"`)
            }
        }


        interaction.editReply("L'achievement a été retiré avec succès.")
    })

}

module.exports.removeAchievement = removeAchievement

let equivalence = {
    "SEASNAILS": ["SEASNAILS1K", "SEASNAILS10K", "SEASNAILS100K", "SEASNAILS250K"],
    "CARDS": ["CARDS10", "CARDS25", "CARDS50", "CARDS100", "CARDS200"],
    "RARITY": ["RARITYS", "RARITYX", "RARITYSEC", "RARITYF"],
    "BM": ["BM1", "BM10", "BM25"],
    "MULTIPLE": ["MULTIPLE10", "MULTIPLE25", "MULTIPLE50", "MULTIPLE10SEC"],
    "RECOMP": ["RECOMPWEEK", "RECOMPMONTH", "RECOMPYEAR"],
    "LEVEL": ["LEVELB", "LEVELA", "LEVELS", "LEVELX"]
}

for (const collectionsKey in collections) {
    let short = collections[collectionsKey].choice.name
    if (short == "FAKE") continue
    equivalence["COLLEC" + short] = [`FULL${short}`, `PERFECT${short}`]
}

console.log(equivalence)

const checkAchievementsToGive = async function (guild, user, achievementList) {

    let myList = await db.select(`SELECT ACHDATA
                                  FROM PLAYERS
                                  WHERE ID = "${user.id}"`, (res) => {
        return res[0].ACHDATA
    })
    let allAchievements = await db.select(`SELECT *
                                           FROM ACHIEVEMENTS`, (res) => {
        let objAll = {}
        for (let i = 0; i < res.length; i++) {
            objAll[res[i].ID] = res[i]
        }
        return objAll
    })

    for (const equivalenceKey in equivalence) {
        if (achievementList.includes(equivalenceKey)) {
            let achList = equivalence[equivalenceKey]
            achievementList.splice(achievementList.indexOf(equivalenceKey), 1)
            achievementList = achievementList.concat(achList)
        }
    }

    let cs = false

    let recomp = 0

    for (let i = 0; i < achievementList.length; i++) {
        let achId = achievementList[i]
        let achievement = allAchievements[achId]
        if (checkBin(achievement.VALUE, myList)){
            if (achId == "CARDS200") cs = true
            continue
        }

        let achProgress = await checkAchievementProgress(user, achId)

        if (achProgress[0] || (!achProgress[0] && achProgress[2])) {
            await newAchievementObtained(guild, user, achievement)
            myList = setBin(achievement.VALUE, myList)
            recomp += achievement.REWARD
            if (achId == "CARDS200") cs = true
        }
    }

    if (recomp) await db.update(`UPDATE PLAYERS
                                 SET SEASNAILS=SEASNAILS + ${recomp},
                                     ACHDATA="${myList}"
                                 WHERE ID = "${user.id}"`, () => {
    })

    //if (cs) checkSecret(guild, user, myList, allAchievements)

}

module.exports.checkAchievementsToGive = checkAchievementsToGive

const checkSecret = async function (guild, user, myList, allAchievements) {

    let newList = myList
    let recomp = 0
    for (const secretsqlKey in secretsql) {
        let achievement = allAchievements[secretsqlKey]
        if (checkBin(achievement.VALUE, myList)) continue
        let achProgress = checkAchievementProgress(user, secretsqlKey)
        if (achProgress[0] || (!achProgress[0] && achProgress[2])) {
            await newAchievementObtained(guild, user, achievement)
            setBin(achievement.VALUE, myList)
            recomp += achievement.REWARD
        } else break
    }
    if (recomp) await db.update(`UPDATE PLAYERS
                                 SET SEASNAILS=SEASNAILS + ${recomp},
                                     ACHDATA="${newList}"
                                 WHERE ID = "${user.id}"`, () => {
    })
}

const newAchievementObtained = async function (guild, user, achievement) {

    let embed = new MessageEmbed().setTitle(achievement.NAME)
    let desc = `**NOUVEL ACHIEVEMENT OBTENU <@${user.id}> !**\n\n${achievement.DESC}\n*Récompense : ${(achievement.REWARD==2000?"Surprise + 2000":achievement.REWARD)} coquillages*\n`;
    (achievement.SECRET == 0 ? embed.setColor(0xC0C0C0) : embed.setColor(0xFFD700))
    embed.setDescription(desc)
    let channel=await guild.channels.fetch('1007698058156453889') //TCG SO GACHA
    //let channel = await guild.channels.fetch('502505240759631873') //TEST
    channel.send({embeds: [embed]})
    await sleep(800)
}

const checkAchievementProgress = async function (user, achId) {
    //return [hasAchievementRequirements, textToPrintInAchievementBox, isAOneTimeCheck]
    if (achId.startsWith("SEASNAILS")) {

        let totalss = await db.select(`SELECT TOTALSEASNAILS
                                       FROM PLAYERS
                                       WHERE ID = "${user.id}"`, (res) => {
            return res[0].TOTALSEASNAILS
        })
        let totaltocheck = 1000
        switch (achId) {
            case "SEASNAILS250K":
                totaltocheck = 250000
                break
            case "SEASNAILS100K":
                totaltocheck = 100000
                break
            case "SEASNAILS10K":
                totaltocheck = 10000
                break
        }
        return (totalss < totaltocheck ? [false, `${totalss}/${totaltocheck} (${Math.round(totalss * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", , false])

    } else if (achId.startsWith("CARDS")) {

        let totalcards = await db.select(`SELECT COUNT(*) AS COUNT
                                          FROM INVENTORY
                                          WHERE PLAYERID = "${user.id}"`, (res) => {
            return res[0].COUNT
        })
        let totaltocheck = parseInt(achId.substring(5))
        return (totalcards < totaltocheck ? [false, `${totalcards}/${totaltocheck} (${Math.round(totalcards * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])

    } else if (achId.startsWith("RARITY")) {


        if(achId=="RARITYF10"){
            let myList = await db.select(`SELECT ACHDATA
                                      FROM PLAYERS
                                      WHERE ID = "${user.id}"`, (res) => {
                return res[0]
            })
            let achValue = await db.select(`SELECT VALUE
                                        FROM ACHIEVEMENTS
                                        WHERE ID = "${achId}";`, async (res) => {
                return res[0].VALUE
            })
            return (checkBin(achValue, myList) ? [true, "**COMPLÉTÉ !**", true] : [false, "Non complété", true])
        }

        let rarity = achId.substring(6)
        if(rarity=="SEC")rarity="✰"

        let hasMaxLevel = await db.select(`SELECT COUNT(*) AS COUNT
                                           FROM INVENTORY i,
                                                CARDS c,
                                                RARITY r
                                           WHERE i.PLAYERID = "${user.id}"
                                             AND c.RARITY = "${rarity}"
                                             AND i.CARDID = c.ID
                                             AND c.RARITY = r.NAME`, (res) => {
            return res[0].COUNT
        })

        return (hasMaxLevel!=0 ? [true, "**COMPLÉTÉ !**", true] : [false, "Non complété", false])
    } else if (achId.startsWith("LEVEL")) {

        let rarity = achId[5]

        let hasMaxLevel = await db.select(`SELECT COUNT(*) AS COUNT
                                           FROM INVENTORY i,
                                                CARDS c,
                                                RARITY r
                                           WHERE i.PLAYERID = "${user.id}"
                                             AND c.RARITY = "${rarity}"
                                             AND i.CARDID = c.ID
                                             AND i.CARDLEVEL = r.MAXLV
                                             AND c.RARITY = r.NAME`, (res) => {
            return res[0].COUNT
        })

        return (hasMaxLevel!=0 ? [true, "**COMPLÉTÉ !**", true] : [false, "Non complété", false])
    } else if (achId.startsWith("BM")) {

        let totaltocheck = 10
        switch (achId) {
            case "BM25":
                totaltocheck = 25
            case "BM10":
                let totalbm = await db.select(`SELECT TOTALBM
                                               FROM PLAYERS
                                               WHERE ID = "${user.id}"`, (res) => {
                    return res[0].TOTALBM
                })
                return (totalbm < totaltocheck ? [false, `${totalbm}/${totaltocheck} (${Math.floor(totalbm * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])
                break
            default:
                let myList = await db.select(`SELECT ACHDATA
                                              FROM PLAYERS
                                              WHERE ID = "${user.id}"`, (res) => {
                    return res[0]
                })
                let achValue = await db.select(`SELECT VALUE
                                                FROM ACHIEVEMENTS
                                                WHERE ID = "${achId}";`, async (res) => {
                    return res[0].VALUE
                })
                return (checkBin(achValue, myList) ? [true, "**COMPLÉTÉ !**", true] : [false, "Non complété", true])
        }

    } else if (achId.startsWith("MULTIPLE")) {

        if (achId == "MULTIPLE10SEC") {
            let totalmultiple = await db.select(`SELECT MAX(QUANTITY) as MAX
                                                 FROM INVENTORY,
                                                      CARDS
                                                 WHERE PLAYERID = "${user.id}"
                                                   AND CARDID = CARDS.ID
                                                   AND RARITY = "✰"`, (res) => {
                return res[0].MAX
            })
            let totaltocheck = 10
            return (totalmultiple < totaltocheck ? [false, `${totalmultiple}/${totaltocheck} (${Math.round(totalmultiple * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])

        } else {
            let totalmultiple = await db.select(`SELECT MAX(QUANTITY) as MAX
                                                 FROM INVENTORY
                                                 WHERE PLAYERID = "${user.id}"`, (res) => {
                return res[0].MAX
            })
            let totaltocheck = parseInt(achId.substring(8))
            return (totalmultiple < totaltocheck ? [false, `${totalmultiple}/${totaltocheck} (${Math.round(totalmultiple * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])
        }

    } else if (achId.startsWith("RECOMP")) {

        if (achId == "RECOMP200") {
            let myList = await db.select(`SELECT ACHDATA
                                          FROM PLAYERS
                                          WHERE ID = "${user.id}"`, (res) => {
                return res[0]
            })
            let achValue = await db.select(`SELECT VALUE
                                            FROM ACHIEVEMENTS
                                            WHERE ID = "${achId}";`, async (res) => {
                return res[0].VALUE
            })
            return (checkBin(achValue, myList) ? [true, "**COMPLÉTÉ !**", true] : [false, "Non complété", true])
        } else if (achId == "RECOMPDAILY") {
            let totaltocheck = 5
            let totaldays = await db.select(`SELECT TOTALTODAY
                                             FROM PLAYERS
                                             WHERE ID = "${user.id}"`, (res) => {
                return res[0].TOTALTODAY
            })
            return (totaldays < totaltocheck ? [false, `${totaldays}/${totaltocheck} (${Math.round(totaldays * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])

        } else {
            let totaltocheck
            switch (achId) {
                case "RECOMPWEEK":
                    totaltocheck = 7
                    break
                case "RECOMPMONTH":
                    totaltocheck = 30
                    break
                case "RECOMPYEAR":
                    totaltocheck = 365
                    break
            }
            let totaldays = await db.select(`SELECT CONSECUTIVEDAYS
                                             FROM PLAYERS
                                             WHERE ID = "${user.id}"`, (res) => {
                return res[0].CONSECUTIVEDAYS
            })
            return (totaldays < totaltocheck ? [false, `${totaldays}/${totaltocheck} (${Math.round(totaldays * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])

        }

    } else if (achId.startsWith("FULL")) {

        let collec = achId.substring(4)
        let totalcollec = await db.select(`SELECT COUNT(*) AS COUNT
                                           FROM INVENTORY,
                                                CARDS
                                           WHERE PLAYERID = "${user.id}"
                                             AND CARDID = CARDS.ID
                                             AND OBTAINABLE = 1
                                             AND COLLECTION = "${collec}"`, (res) => {
            return res[0].COUNT
        })
        let totaltocheck = await db.select(`SELECT COUNT(*) AS COUNT
                                            FROM CARDS
                                            WHERE COLLECTION = "${collec}"
                                              AND OBTAINABLE = 1`, (res) => {
            return res[0].COUNT
        })
        return (totalcollec < totaltocheck ? [false, `${totalcollec}/${totaltocheck} (${Math.round(totalcollec * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])

    } else if (achId.startsWith("PERFECT")) {

        let collec = achId.substring(7)
        let totalcollec = await db.select(`SELECT COUNT(*) AS COUNT
                                           FROM INVENTORY i,
                                                CARDS c,
                                                RARITY r
                                           WHERE PLAYERID = "${user.id}"
                                             AND i.CARDID = c.ID
                                             AND c.OBTAINABLE = 1
                                             AND c.COLLECTION = "${collec}"
                                             AND c.RARITY = r.NAME
                                             AND i.CARDLEVEL = r.MAXLV`, (res) => {
            return res[0].COUNT
        })
        let totaltocheck = await db.select(`SELECT COUNT(*) AS COUNT
                                            FROM CARDS
                                            WHERE COLLECTION = "${collec}"
                                              AND OBTAINABLE = 1`, (res) => {
            return res[0].COUNT
        })
        return (totalcollec < totaltocheck ? [false, `${totalcollec}/${totaltocheck} (${Math.round(totalcollec * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])

    } else if (Object.keys(secretsql).includes(achId)) {

        if (achId == Object.keys(secretsql)[0]) {
            let res = await db.select(secretsql.values()[0], (res) => {
                return res[0]
            })
            let totalsecret = res.INV
            let totaltocheck = res.TOT
            return (totalsecret < totaltocheck ? [false, `${totalsecret}/${totaltocheck} (${Math.round(totalsecret * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])

        } else {
            let res = await db.select(secretsql.values()[1], (res) => {
                return res[0]
            })
            let totalsecret = res.INV
            let totaltocheck = res.TOT
            return (totalsecret < totaltocheck ? [false, `${totalsecret}/${totaltocheck} (${Math.round(totalsecret * 100 / totaltocheck)}%)`, false] : [true, "**COMPLÉTÉ !**", false])
        }

    } else {
        let myList = await db.select(`SELECT ACHDATA
                                      FROM PLAYERS
                                      WHERE ID = "${user.id}"`, (res) => {
            return res[0]
        })
        let achValue = await db.select(`SELECT VALUE
                                        FROM ACHIEVEMENTS
                                        WHERE ID = "${achId}";`, async (res) => {
            return res[0].VALUE
        })
        return (checkBin(achValue, myList) ? [true, "**COMPLÉTÉ !**", true] : [false, "Non complété", true])
    }
}
