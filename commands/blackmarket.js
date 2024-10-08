const { SlashCommandBuilder } = require('@discordjs/builders');
const fs=require("fs")

const data = new SlashCommandBuilder()
    .setName('blackmarket')
    .setDescription('Commandes liées au marché noir')
    .addSubcommand(subcommand =>
        subcommand
            .setName('acheter')
            .setDescription('Permet d\'acheter une carte au marché noir.')
            .addIntegerOption(option => option.setName('id').setDescription('ID de la carte à acheter').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('retirer')
            .setDescription('Permet de retirer une de vos cartes de la vente.')
            .addIntegerOption(option => option.setName('id').setDescription('ID de la carte à retirer').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('vendre')
            .setDescription('Permet de mettre une carte à la vente, pour au moins son prix de compensation.')
            .addStringOption(option => option.setName('carte').setDescription('Nom de la carte à rechercher').setRequired(true))
            .addIntegerOption(option => option.setName('prix').setDescription('Prix de vente, supérieur à la compensation de la carte').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('rechercher')
            .setDescription('Recherchez une carte en particulier sur le marché noir.')
            .addStringOption(option => option.setName('carte').setDescription('Nom de la carte à rechercher').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('liste')
            .setDescription('Liste toutes les cartes, propriétaires, et prix du marché noir (admin seulement)'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('gacha')
            .setDescription('Permet d\'acheter une carte aléatoire de rareté garantie au marché noir.')
            .addStringOption(option => option.setName('rareté').setDescription('Rareté de la carte à acheter').setRequired(true).addChoices(
                {name: '✰', value:'✰'},
                {name: 'X', value:'X'},
                {name: 'S', value:'S'}
            )))


module.exports.data=data;

const db=require("../db")
const rarity=require("../rarity.json")

const {MessageEmbed, MessageAttachment, MessageActionRow, MessageSelectMenu, TextChannel} = require("discord.js");
const {toFileString, setEmbedColor} = require("./util");
const permissions = require("./permissions");
const gacha = require("./gacha");
const achievement = require("./achievement");
const {checkAchievementsToGive} = require("./achievement");

const sellCardBase=async function(user,cardname, price ,sql,interaction){
    await db.select(sql,async (card)=>{
        if (card.length==0){
            await interaction.editReply("Aucune carte trouvée.")
        }else if (card.length==1){
            let cardid=card[0].ID
            let cardcollec=card[0].COLLECTION
            let cardname=card[0].NAME
            let cardrarity=card[0].RARITY
            let cardnumber = card[0].NUMBER
            let sql="SELECT co.NAME as COLLECNAME, * FROM COLLECTIONS co, CARDS, INVENTORY WHERE PLAYERID='"+user.id+"' AND CARDID="+cardid+" AND ID="+cardid+" AND SHORT=COLLECTION";
            await db.select(sql,async (res)=>{
                if(res.length==1){
                    let sql=`SELECT * FROM BLACKMARKET WHERE OWNERID=${user.id} AND CARDID=${cardid}`
                    let quantitySold = await db.select(sql,(res)=> {
                        return res
                    })
                    if (quantitySold.length>=res[0].QUANTITY) return interaction.editReply("Vous n'avez plus de quoi mettre cette carte en vente !")
                    let pricemin=rarity[cardrarity].compensation;
                    if (price<pricemin) return interaction.editReply("Vous ne pouvez pas vendre cette carte à moins de "+pricemin+" coquillages.")
                    let sellid=Date.now()
                    sellid=sellid-Math.floor(sellid/100000)*100000
                    sql=`INSERT INTO BLACKMARKET(SELLID, OWNERID, CARDID, PRICE) VALUES (${sellid}, ${user.id}, ${cardid}, ${price})`
                    await db.insert(sql, async ()=>{})
                    interaction.editReply(`Vous avez mis ${cardname} au marché noir pour ${price} coquillages.`)
                }
                else{
                    interaction.editReply("Vous ne pouvez pas vendre une carte que vous ne possédez pas !")
                }
            });
        }else{
            let options=[]
            for (let i=0;i<card.length;i++){
                let c=card[i]
                let collection = await db.select("SELECT co.* FROM COLLECTIONS co, CARDS ca WHERE ca.COLLECTION=co.SHORT AND ca.ID="+c.ID,(res)=> {
                    return res[0]
                });
                let obj={}
                obj.label=c.NAME
                obj.description=collection.NAME+" - "+c.RARITY
                obj.value=""+c.ID
                options.push(obj)
            }

            const row = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                        .setCustomId(`sell_${user.id}_${price}`)
                        .setPlaceholder('Sélectionnez une carte')
                        .addOptions(options)
                );

            await interaction.editReply({components:[row]})
        }
    });
}

const sellCard=async function(interaction){
    let user = interaction.user
    let cardname=interaction.options.getString("carte")
    let price=interaction.options.getInteger("prix")
    let sql="SELECT * FROM CARDS ca, INVENTORY i WHERE i.CARDID=ca.ID AND i.PLAYERID='"+user.id+"' AND UPPER(ca.NAME) LIKE UPPER('%"+cardname+"%')"
    sellCardBase(user,cardname,price,sql,interaction)
};

module.exports.sellCard = sellCard

const sellCardSelectMenu = function (interaction){
    let user = interaction.user
    let cardid=interaction.values[0]
    let price=interaction.customId.split("_")[2]
    let sql='SELECT * FROM CARDS WHERE ID='+cardid
    sellCardBase(user,cardid,price,sql,interaction)
}

module.exports.sellCardSelectMenu=sellCardSelectMenu

const removeCard=async function(interaction){
    let user = interaction.user
    let idTrans=interaction.options.getInteger("id")
    let sql = `SELECT * FROM BLACKMARKET WHERE SELLID=${idTrans}`
    await db.select(sql, async (res)=>{
        if (res.length==0) {
            interaction.editReply("Cette transaction n'existe pas.")
        }else if (res[0].OWNERID!=user.id){
            interaction.editReply("Vous ne pouvez pas retirer une transaction qui ne vous appartient pas.")
        }else{
            let sql= `DELETE FROM BLACKMARKET WHERE SELLID=${idTrans}`
            await db.delete(sql, ()=>{})
            interaction.editReply("Transaction retirée.")
        }
    })
}

module.exports.removeCard = removeCard

const searchMarket=async function(interaction){
    let user = interaction.user
    let cardname = interaction.options.getString("carte")
    let sql=`SELECT ca.NAME as NAME, b.SELLID as SELLID, b.PRICE as PRICE FROM CARDS ca, BLACKMARKET b WHERE ca.ID=b.CARDID AND UPPER(ca.NAME) LIKE UPPER("%${cardname}%")`
    await db.select(sql,(res)=>{
        if (res.length==0) return interaction.editReply("Aucune carte disponible pour cette recherche.")
        let embed=new MessageEmbed().setTitle("Carte - Prix - ID")
        let desc=""
        for (let i = 0; i < res.length; i++) {
            let c=res[i]
            desc+=`${c.NAME} - ${c.PRICE} - ${c.SELLID}\n`
        }
        embed.setDescription(desc)
        interaction.editReply({embeds:[embed]})
    });
};

module.exports.searchMarket=searchMarket

const addCardToInventory = async function(user,cardinfo,interaction){
    let sql="SELECT * FROM INVENTORY WHERE PLAYERID='"+user.id+"' AND CARDID="+cardinfo.ID
    let cardname=cardinfo.NAME
    let cardtitle=cardinfo.TITLE
    let cardcollec=cardinfo.COLLECTION
    let cardid=cardinfo.ID
    let cardnumber=cardinfo.NUMBER
    await db.select(sql,async (res)=>{
        if (res.length==0){
            if((await db.select("SELECT * FROM PLAYERS WHERE ID='"+user.id+"'")).length==0)return interaction.editReply("Le compte n'a pas été trouvé.")

            let sql="INSERT INTO INVENTORY (PLAYERID, CARDID, QUANTITY) VALUES ('"+user.id+"',"+cardinfo.ID+",1)"
            await db.insert(sql,()=>{})

            let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level1.png")
            let name=toFileString(cardname+".png")
            let attachement = new MessageAttachment(file,name)
            let embed=new MessageEmbed()
                .setTitle(cardinfo.NAME)
                .setDescription(`*${cardtitle}*`+
                    "\n\n__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                    "\n**"+cardinfo.RARITY+"**"+
                    (cardinfo.RARITY!="✰"?"\nNiveau 1":""))
                .setImage("attachment://"+name)
            embed=setEmbedColor(cardinfo.RARITY, embed)
            await interaction.editReply({embeds:[embed],files:[attachement],content:user.toString()+" a acheté "+cardinfo.NAME+" !"})
        }else{
            let rarityinfo = rarity[cardinfo.RARITY]
            if (res[0].CARDLEVEL==rarityinfo.maxlv){
                let sql="UPDATE PLAYERS SET SEASNAILS=(SELECT SEASNAILS+"+rarityinfo.compensation+" FROM PLAYERS WHERE ID='"+user.id+"') WHERE ID='"+user.id+"'";
                await db.update(sql,()=>{})
                sql = `UPDATE INVENTORY SET QUANTITY=QUANTITY+1 WHERE CARDID=${cardinfo.ID} and PLAYERID="${user.id}"`
                await db.update(sql,()=>{})
                interaction.editReply(user.toString()+" a déjà "+cardinfo.NAME+" au niveau maximum, donc reçoit "+rarityinfo.compensation+" coquillages en compensation !")
            }else if(res[0].NBPOSSESSED+1==rarityinfo.tonextlv){
                let newlv= res[0].CARDLEVEL+1
                let sql="UPDATE INVENTORY SET CARDLEVEL="+newlv+", NBPOSSESSED=0 WHERE PLAYERID='"+user.id+"' AND CARDID="+cardinfo.ID+""
                await db.update(sql,()=>{})
                sql = `UPDATE INVENTORY SET QUANTITY=QUANTITY+1 WHERE CARDID=${cardinfo.ID} and PLAYERID="${user.id}"`
                await db.update(sql,()=>{})

                let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+newlv+".png")
                let name=toFileString(cardname+".png")
                let attachement = new MessageAttachment(file,name)
                let embed=new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription(`*${cardtitle}*`+
                        "\n\n__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                        "\n**"+cardinfo.RARITY+"**"+
                        (cardinfo.RARITY!="✰"?"\nNiveau "+newlv:""))
                    .setImage("attachment://"+name)
                embed=setEmbedColor(cardinfo.RARITY, embed)
                await interaction.editReply({embeds:[embed],files:[attachement],content:user.toString()+" a acheté "+cardinfo.NAME+" ! Elle passe au niveau "+newlv+" !"})
            }else{
                let sql="UPDATE INVENTORY SET NBPOSSESSED="+(res[0].NBPOSSESSED+1)+" WHERE PLAYERID='"+user.id+"' AND CARDID='"+cardinfo.ID+"'"
                await db.update(sql,()=>{})
                sql = `UPDATE INVENTORY SET QUANTITY=QUANTITY+1 WHERE CARDID=${cardinfo.ID} and PLAYERID="${user.id}"`
                await db.update(sql,()=>{})

                let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+res[0].CARDLEVEL+".png")
                let name=toFileString(cardname+".png")
                let attachement = new MessageAttachment(file,name)
                let embed=new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription(`*${cardtitle}*`+
                        "\n\n__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                        "\n**"+cardinfo.RARITY+"**"+
                        (cardinfo.RARITY!="✰"?"\nNiveau "+res[0].CARDLEVEL:""))
                    .setImage("attachment://"+name)
                embed=setEmbedColor(cardinfo.RARITY, embed)
                await interaction.editReply({embeds:[embed],files:[attachement],content:user.toString()+" a acheté "+cardinfo.NAME+" !"})
            }
        }
    })
}

const delCard=async function(ownerId, cardId){
    await db.delete(`DELETE FROM BLACKMARKET WHERE OWNERID=${ownerId} AND CARDID=${cardId}`)

    let sql=`SELECT ca.RARITY, i.* FROM CARDS ca, INVENTORY i WHERE i.CARDID=${cardId} AND i.PLAYERID='${ownerId}' AND ca.ID=i.CARDID`
    await db.select(sql, async (res)=>{
        let inv=res[0];
        inv.QUANTITY-=1;

        if(inv.QUANTITY==0){
            let sql = `DELETE FROM INVENTORY WHERE CARDID=${cardId} AND PLAYERID='${ownerId}'`;
            return await db.delete(sql, ()=>{});
        }

        let checkQuantity = rarity[inv.RARITY].tonextlv*inv.CARDLEVEL+inv.NBPOSSESSED
        if (inv.QUANTITY<checkQuantity) inv.NBPOSSESSED-=1;
        if (inv.NBPOSSESSED==-1){
            inv.NBPOSSESSED=rarity[inv.RARITY].tonextlv-1;
            inv.CARDLEVEL-=1;
        }

        let sql=`UPDATE INVENTORY SET NBPOSSESSED=${inv.NBPOSSESSED}, QUANTITY=${inv.QUANTITY}, CARDLEVEL=${inv.CARDLEVEL} WHERE CARDID=${cardId} AND PLAYERID='${ownerId}'`
        await db.update(sql, ()=>{})
    })
};

const buyCard=async function(interaction){
    let user=interaction.user
    let sellId=interaction.options.getInteger("id")
    let sql=`SELECT ca.RARITY, b.* FROM CARDS ca, BLACKMARKET b WHERE SELLID=${sellId} AND b.CARDID=ca.ID`
    await db.select(sql, async (res)=>{
       if(res.length==0) return await interaction.editReply("La transaction demandée n'existe pas.");
       let ownerId=res[0].OWNERID;
       if (ownerId==user.id) return await interaction.editReply("Vous ne pouvez pas acheter votre propre carte !")
       let cardId=res[0].CARDID;

       let checkSnails=await db.select(`SELECT SEASNAILS from PLAYERS WHERE ID="${user.id}"`,(res)=>{return res[0].SEASNAILS});
       if (checkSnails<res[0].PRICE) return await interaction.editReply("Vous n'avez pas assez pour acheter cette carte !");

       let effectiveGain=res[0].PRICE-rarity[res[0].RARITY].compensation

       await db.update(`UPDATE PLAYERS SET SEASNAILS=SEASNAILS+${(effectiveGain>0?effectiveGain:0)}, TOTALBM=TOTALBM+1 WHERE ID="${res[0].OWNERID}"`,()=>{});
       await db.update(`UPDATE PLAYERS SET SEASNAILS=SEASNAILS-${res[0].PRICE}, TOTALBM=TOTALBM+1 WHERE ID="${user.id}"`,()=>{});
       await delCard(ownerId, cardId);
       let sql=`SELECT * FROM CARDS WHERE ID=${cardId}`;
       await db.select(sql, async (res)=>{
           let cardinfo=res[0]
           await addCardToInventory(user, cardinfo,interaction)
           if(cardinfo.RARITY=="F")await achievement.checkAchievementsToGive(interaction.guild, user,["BMF"])
       })
        let owner=await interaction.guild.members.fetch(ownerId)
        await achievement.checkAchievementsToGive(interaction.guild, owner,["BM"])
        await achievement.checkAchievementsToGive(interaction.guild, user,["BM"])
    });
}

module.exports.buyCard=buyCard

const showAllBM=async function(interaction){
    let user = interaction.user
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    let sql=`SELECT ca.NAME as CARDNAME, ca.RARITY as RARITY, ca.COLLECTION as COLLEC, b.PRICE as PRICE, p.NAME as PLAYERNAME FROM CARDS ca, BLACKMARKET b, PLAYERS p WHERE ca.ID=b.CARDID AND b.OWNERID=p.ID`
    await db.select(sql,(res)=>{
        if (res.length==0) return interaction.editReply("Aucune carte disponible.")
        let embed=new MessageEmbed().setTitle("Propriétaire - Carte - Prix")
        let desc=""
        for (let i = 0; i < res.length; i++) {
            let c=res[i]
            desc+=`${c.PLAYERNAME} - ${c.COLLEC} ${c.RARITY} ${c.CARDNAME} - ${c.PRICE}\n`
        }
        embed.setDescription(desc)
        interaction.editReply({embeds:[embed]})
    });
}

module.exports.showAllBM=showAllBM

const showWeekly=async function(channel){
    let sql=`SELECT b.SELLID as SELLID, ca.NAME as CARDNAME, b.PRICE as PRICE FROM CARDS ca, BLACKMARKET b WHERE ca.ID=b.CARDID`
    await db.select(sql,(res)=>{
        if (res.length==0) return interaction.editReply("Aucune carte disponible.")
        let embed=new MessageEmbed().setTitle("Cartes disponibles au marché noir :")
        let desc=""
        for (let i = 0; i < res.length; i++) {
            let c=res[i]
            desc+=`${c.SELLID} - ${c.CARDNAME} - ${c.PRICE} coquillages\n`
        }
        embed.setDescription(desc)
        channel.send({embeds:[embed]})
    });
}

module.exports.showWeekly=showWeekly

const pricesBM={
    "S" : 60,
    "X" : 300,
    "✰" : 600
}

const checkBMGacha = async function (interaction) {
    let user = interaction.user;
    let forcedRarity=interaction.options.get("rareté").value
    let sql = "SELECT * FROM PLAYERS WHERE ID='" + user.id + "'"
    await db.select(sql,async (res)=> {
        if (res.length == 0) return interaction.editReply("Impossible de trouver le compte.")
        let player = res[0];
        let price=pricesBM[forcedRarity]
        if (player.SEASNAILS < price) return interaction.editReply(`Il te faut ${price} coquillages pour tirer cette rareté !`)
        player.price = price
        await db.update(`UPDATE PLAYERS SET TOTALBM=TOTALBM+1 WHERE ID="${user.id}"`)
        await gacha.playGacha(interaction, player, forcedRarity)
    })
}

module.exports.checkBMGacha=checkBMGacha