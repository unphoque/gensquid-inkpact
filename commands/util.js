const {MessageEmbed}=require("discord.js")

const toFileString=function(txt){
    txt=txt.replaceAll(" ","_")
    txt=txt.replaceAll("'","_").replaceAll("\"","_")
    txt=txt.replaceAll(",","_")
    txt=txt.replaceAll("(","").replaceAll(")","")
    txt=txt.replaceAll("&","_")
    txt=txt.replaceAll("?","_").replaceAll("!","_")

    txt=txt.replaceAll("à","a").replaceAll("ä","a").replaceAll("â","a")
    txt=txt.replaceAll("ç","c")
    txt=txt.replaceAll("é","e").replaceAll("è","e").replaceAll("ê","e")
    txt=txt.replaceAll("ï","i").replaceAll("î","i")
    txt=txt.replaceAll("ö","o").replaceAll("ô","o")

    return txt
}

module.exports.toFileString=toFileString

const setEmbedColor=function(rarity, embed){
    switch (rarity) {
        case "C":
        case "F":
            embed.setColor(0x000000)
            break
        case "B":
            embed.setColor(0xCD7F32)
            break
        case "A":
            embed.setColor(0xC0C0C0)
            break
        case "S":
            embed.setColor(0xFFD700)
            break
        case "X":
        case "✰":
            embed.setColor(0xE5E4E2)
            break
    }

    return embed
}

module.exports.setEmbedColor=setEmbedColor

const sleep = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.sleep=sleep