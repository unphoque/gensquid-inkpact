const { SlashCommandBuilder } = require('@discordjs/builders');
const permissions=require("./permissions")

const data = new SlashCommandBuilder()
    .setName('échange')
    .setDescription('Échange des cartes entre deux joueurs (admin seulement)')
    .addUserOption(option => option.setName('joueur_1').setDescription('Joueur 1').setRequired(true))
    .addStringOption(option => option.setName('cartes_1').setDescription('Cartes de J1 (ex: Réa,Emerine)').setRequired(true))
    .addUserOption(option => option.setName('joueur_2').setDescription('Joueur 2').setRequired(true))
    .addStringOption(option => option.setName('cartes_2').setDescription('Cartes de J2 (ex: Réa,Emerine)').setRequired(true))

//module.exports.data=data;

const db=require("../db.js")
const {MessageActionRow, MessageSelectMenu, MessageButton, MessageAttachment, MessageEmbed} = require("discord.js");
const {toFileString} = require("./util");
const rarity = require("../rarity.json");

let exchanges=new Map()

const createExchange=async function(interaction){
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    let user1=interaction.options.getUser("joueur_1")
    let user2=interaction.options.getUser("joueur_2")
    let user1toEx=interaction.options.getString("cartes_1").split(",")
    let user2toEx=interaction.options.getString("cartes_2").split(",")

    let user1Cards = await db.select("SELECT * FROM INVENTORY WHERE PLAYERID='"+user1.id+"'",(res)=>{return res})
    let user2Cards = await db.select("SELECT * FROM INVENTORY WHERE PLAYERID='"+user1.id+"'",(res)=>{return res})

    if (user1Cards.length==0 || user2Cards.length==0)return interaction.editReply("Un des deux joueurs n'a pas de cartes à échanger !")

    let user1options=[]
    for (const c of user1Cards) {
        user1options.push(c.CARDNAME)
    }
    let user2options=[]
    for (const c of user2Cards) {
        user2options.push(c.CARDNAME)
    }

    for (const e of user1toEx){
        if (!user1options.includes(e)){
            return interaction.editReply(user1.username+" ne possède pas la carte "+e+" (Attention à l'orthographe des cartes !)")
        }
    }

    for (const e of user2toEx){
        if (!user2options.includes(e)){
            return interaction.editReply(user2.username+" ne possède pas la carte "+e+" (Attention à l'orthographe des cartes !)")
        }
    }

    obj={}
    obj.interaction=interaction
    obj.user1=user1
    obj.user2=user2
    obj.user1toEx=user1toEx
    obj.user2toEx=user2toEx

    d = new Date().getTime()
    exchanges.set(d, obj)

    const rows = [
            new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('ex_ok_'+d)
                    .setLabel('C\'est parti !')
                    .setStyle('SUCCESS'),
                new MessageButton()
                    .setCustomId('ex_no_'+d)
                    .setLabel('On arrête tout !')
                    .setStyle('DANGER'),
            )
    ];

    await interaction.editReply({ content: 'Echange entre '+user1.username+' et '+user2.username, components: rows });
};

module.exports.createExchange=createExchange

const getCardInfo=async function(user, cardname){
    let sql="SELECT * FROM CARDS WHERE UPPER(NAME) LIKE UPPER('"+cardname+"')"
    return await db.select(sql,async (card)=>{
        if (card.length==0){
            await interaction.editReply("La carte demandée n'existe pas.")
            return
        }else{
            return card[0]
        }
    });
};

const addCardToInventory = async function(user,cardinfo){
    let sql="SELECT * FROM INVENTORY WHERE PLAYERID='"+user.id+"' AND CARDNAME='"+cardinfo.NAME+"'"
    await db.select(sql,async (res)=>{
        if (res.length==0){
            let sql="INSERT INTO INVENTORY (PLAYERID, CARDID) VALUES ('"+user.id+"','"+cardinfo.NAME+"')"
            await db.insert(sql,()=>{})

            let cardname=cardinfo.NAME
            let file=toFileString("./img/"+cardname+"_1.png")
            let name=toFileString(cardname+".png")
            let attachement = new MessageAttachment(file,name)
            let embed=new MessageEmbed()
                .setTitle(cardinfo.NAME)
                .setDescription("**"+cardinfo.RARITY+"**"+
                    "\nNiveau 1")
                .setImage("attachment://"+name)

            await interaction.editReply({embeds:[embed],files:[attachement],content:user.toString()+" a reçu "+cardinfo.NAME+" !"})
        }else{
            let rarityinfo = rarity[cardinfo.RARITY]
            if (res[0].CARDLEVEL==rarityinfo.maxlv){
                let sql="UPDATE PLAYERS SET SEASNAILS=(SELECT SEASNAILS+"+rarityinfo.compensation+" FROM PLAYERS WHERE ID='"+user.id+"') WHERE ID='"+user.id+"'";
                await db.update(sql,()=>{})
            }else if(res[0].NBPOSSESSED+1==rarityinfo.tonextlv){
                let newlv= res[0].CARDLEVEL+1
                let sql="UPDATE INVENTORY SET CARDLEVEL="+newlv+", NBPOSSESSED=0 WHERE PLAYERID='"+user.id+"' AND CARDNAME='"+cardinfo.NAME+"'"
                await db.update(sql,()=>{})
            }else{
                let sql="UPDATE INVENTORY SET NBPOSSESSED="+(res[0].NBPOSSESSED+1)+" WHERE PLAYERID='"+user.id+"' AND CARDNAME='"+cardinfo.NAME+"'"
                await db.update(sql,()=>{})
            }
        }
    })
}

const executeExchange=async function(interaction){

    let [ex,answer,id] = interaction.customId.split("_")
    if (answer=="no"){
        await interaction.editReply("Échange annulé.")
    }
    else {
        let exInfo = exchanges.get(id)

        for (const c of exInfo.user1toEx){
            await addCardToInventory(exInfo.user2, await getCardInfo(c))
        }
        for (const c of exInfo.user2toEx){
            await addCardToInventory(exInfo.user1, await getCardInfo(c))
        }

    }

};

module.exports.executeExchange=executeExchange