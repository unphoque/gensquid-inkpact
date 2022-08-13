const { SlashCommandBuilder } = require('@discordjs/builders');
const {MessageActionRow, MessageSelectMenu} = require("discord.js")

const data = new SlashCommandBuilder()
    .setName('carte')
    .setDescription('Commandes liées aux cartes')
    .addSubcommand(subcommand =>
        subcommand
            .setName('voir')
            .setDescription('Affiche une carte ! Les cartes que vous ne possédez pas seront avec une ombre.')
            .addStringOption(option => option.setName("carte").setDescription('Nom de la carte').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('liste')
            .setDescription('Affiche la liste de vos cartes et leur niveau !'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('joueur')
            .setDescription('Affiche la liste des cartes d\'un joueur (admin seulement)')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('give')
            .setDescription('Donne une carte à un joueur (admin seulement)')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true))
            .addStringOption(option => option.setName('carte').setDescription('La carte').setRequired(true)))
    /*.addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Retire une carte à un joueur')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true))
            .addStringOption(option => option.setName('carte').setDescription('La carte').setRequired(true)))*/

module.exports.data=data;

const { MessageEmbed, MessageAttachment} = require('discord.js');
const db=require("../db.js")
const {toFileString} = require("./util")
const permissions = require("./permissions");
const rarity=require("../rarity.json")

const showCard=async function(interaction){
    let user = interaction.user
    let cardname=interaction.options.getString("carte")
    let sql="SELECT * FROM CARDS WHERE UPPER(NAME) LIKE UPPER('%"+cardname+"%')"
    await db.select(sql,async (card)=>{
        if (card.length==0){
            await interaction.editReply("Aucune carte trouvée.")
        }else if (card.length==1){
            let cardid=card[0].ID
            let cardcollec=card[0].COLLECTION
            let cardname=card[0].NAME
            let cardnumber = card[0].NUMBER
            let sql="SELECT co.NAME as COLLECNAME, * FROM COLLECTIONS co, CARDS, INVENTORY WHERE PLAYERID='"+user.id+"' AND CARDID="+cardid+" AND ID="+cardid+" AND SHORT=COLLECTION";
            await db.select(sql,async (res)=>{
                if(res.length==1){
                    let level=res[0].CARDLEVEL
                    let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+level+".png")
                    let name=toFileString(cardname+".png")
                    let attachement = new MessageAttachment(file,name)
                    let embed=new MessageEmbed()
                        .setTitle(cardname)
                        .setDescription("__**"+res[0].COLLECNAME+"**__ - n° "+cardnumber+"/"+res[0].MAX+
                            "\n**"+card[0].RARITY+"**"+
                            (card[0].RARITY!="✰"?"\nNiveau "+level:""))
                        .setImage("attachment://"+name)
                        //.setImage("http://127.0.0.1/")

                    interaction.editReply({embeds:[embed],files:[attachement]})
                }
                else{
                    let collection = await db.select("SELECT co.* FROM COLLECTIONS co, CARDS ca WHERE ca.COLLECTION=co.SHORT AND ca.ID="+cardid,(res)=> {
                        return res[0]
                    });
                    let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level1.png")
                    let name=toFileString(cardname+".png")
                    let attachement = new MessageAttachment(file,name)
                    let embed=new MessageEmbed()
                        .setTitle(cardname)
                        .setDescription("__**"+collection.NAME+"**__ - n° "+cardnumber+"/"+collection.MAX+
                            "\n**"+card[0].RARITY+"**"+
                            "\nNon possédée")
                        .setImage("attachment://"+name)

                    interaction.editReply({embeds:[embed],files:[attachement]})
                }
            });
        }else{
            let options=[]
            for (let i=0;i<card.length;i++){
                let c=card[i]
                let obj={}
                obj.label=c.NAME
                obj.description=c.NAME+" - "+c.RARITY
                obj.value=toFileString(c.NAME)
                options.push(obj)
            }

            const row = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                        .setCustomId('voir_'+user.id)
                        .setPlaceholder('Sélectionnez une carte')
                        .addOptions(options)
                );

            await interaction.editReply({components:[row]})
        }
    });
};

module.exports.showCard=showCard

const showCardSelectMenu = function (interaction){
    let user = interaction.user
    let cardname=interaction.options.getString("carte")
    console.log(interaction)
    let sql="SELECT * FROM CARDS"
    interaction.editReply("")
}

module.exports.showCardSelectMenu=showCardSelectMenu

const showAllCards=async function(interaction){
    let user = interaction.user
    if (interaction.options.getUser("joueur")) {
        if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
        else user = interaction.options.getUser("joueur")
    }
    let sql="SELECT * FROM CARDS, INVENTORY WHERE PLAYERID='"+user.id+"' AND ID=CARDID"
    await db.select(sql,(res)=>{
        let embed=new MessageEmbed().setTitle("Inventaire de "+user.username)
        let desc=""
        for (let i = 0; i < res.length; i++) {
            let c=res[i]
            desc+=c.NAME+" - Niveau "+c.CARDLEVEL+"\n"
        }
        embed.setDescription(desc)
        interaction.editReply({embeds:[embed]})
    });
};

module.exports.showAllCards=showAllCards

const addCardToInventory = async function(user,cardinfo,interaction){
    let sql="SELECT * FROM INVENTORY WHERE PLAYERID='"+user.id+"' AND CARDID="+cardinfo.ID
    let cardname=cardinfo.NAME
    let cardcollec=cardinfo.COLLECTION
    let cardid=cardinfo.ID
    let cardnumber=cardinfo.NUMBER
    await db.select(sql,async (res)=>{
        if (res.length==0){
            let sql="INSERT INTO INVENTORY (PLAYERID, CARDID) VALUES ('"+user.id+"','"+cardinfo.ID+"')"
            await db.insert(sql,()=>{})

            let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level1.png")
            let name=toFileString(cardname+".png")
            let attachement = new MessageAttachment(file,name)
            let embed=new MessageEmbed()
                .setTitle(cardinfo.NAME)
                .setDescription("__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                    "\n**"+cardinfo.RARITY+"**"+
                    (cardinfo.RARITY!="✰"?"\nNiveau 1":""))
                .setImage("attachment://"+name)

            await interaction.editReply({embeds:[embed],files:[attachement],content:user.toString()+" a reçu "+cardinfo.NAME+" !"})
        }else{
            let rarityinfo = rarity[cardinfo.RARITY]
            if (res[0].CARDLEVEL==rarityinfo.maxlv){
                let sql="UPDATE PLAYERS SET SEASNAILS=(SELECT SEASNAILS+"+rarityinfo.compensation+" FROM PLAYERS WHERE ID='"+user.id+"') WHERE ID='"+user.id+"'";
                await db.update(sql,()=>{})
                interaction.editReply(user.toString()+" a déjà "+cardinfo.NAME+" au niveau maximum, donc reçoit "+rarityinfo.compensation+" coquillages en compensation !")
            }else if(res[0].NBPOSSESSED+1==rarityinfo.tonextlv){
                let newlv= res[0].CARDLEVEL+1
                let sql="UPDATE INVENTORY SET CARDLEVEL="+newlv+", NBPOSSESSED=0 WHERE PLAYERID='"+user.id+"' AND CARDID='"+cardinfo.ID+"'"
                await db.update(sql,()=>{})

                let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+newlv+".png")
                let name=toFileString(cardname+".png")
                let attachement = new MessageAttachment(file,name)
                let embed=new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription("__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                        "\n**"+cardinfo.RARITY+"**"+
                        (cardinfo.RARITY!="✰"?"\nNiveau "+newlv:""))
                    .setImage("attachment://"+name)

                await interaction.editReply({embeds:[embed],files:[attachement],content:user.toString()+" a reçu "+cardinfo.NAME+" ! Elle passe au niveau "+newlv+" !"})
            }else{
                let sql="UPDATE INVENTORY SET NBPOSSESSED="+(res[0].NBPOSSESSED+1)+" WHERE PLAYERID='"+user.id+"' AND CARDID='"+cardinfo.ID+"'"
                await db.update(sql,()=>{})

                let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+res[0].CARDLEVEL+".png")
                let name=toFileString(cardname+".png")
                let attachement = new MessageAttachment(file,name)
                let embed=new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription("__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                        "\n**"+cardinfo.RARITY+"**"+
                        (cardinfo.RARITY!="✰"?"\nNiveau "+res[0].CARDLEVEL:""))
                    .setImage("attachment://"+name)

                await interaction.editReply({embeds:[embed],files:[attachement],content:user.toString()+" a reçu "+cardinfo.NAME+" !"})
            }
        }
    })
}

const giveCard=async function(interaction){
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")

    let user=interaction.options.getUser("joueur")
    let cardname=interaction.options.getString("carte")
    let sql="SELECT co.NAME as COLLECNAME, * FROM COLLECTIONS co, CARDS ca WHERE UPPER(ca.NAME)LIKE UPPER('"+cardname+"') AND ca.COLLECTION=co.SHORT"
    await db.select(sql,async (res)=>{
        if (res.length==1){
            let cardinfo=res[0]
            await addCardToInventory(user,cardinfo,interaction)
        }else{
            await interaction.editReply("La carte demandée n'existe pas.")
        }
    });
};

module.exports.giveCard=giveCard