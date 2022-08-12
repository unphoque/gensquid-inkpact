const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('joueur')
    .setDescription('Commandes liées à votre compte')
    .addSubcommand(subcommand =>
        subcommand
            .setName('créer')
            .setDescription('Créé ton compte Squid Order TCG !'))
    .addSubcommand(subcommand =>
        subcommand
        .setName('suppr')
        .setDescription('Supprime ton compte Squid Order TCG. Attention, cela est définitif !'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('ban')
            .setDescription('Supprime le compte mentionné (admin seulement). Attention, cela est définitif !')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true)))

module.exports.data=data

const db=require("../db.js")
const permissions = require("./permissions");

const createPlayer=async function(interaction){
    let user = interaction.user
    let sql="INSERT INTO PLAYERS(ID,NAME) VALUES ('"+user.id+"','"+user.username+"')"
    await db.insert(sql,(res)=>{
        if(res[1]==1){
            interaction.editReply("Ton compte a bien été créé !")
        }
        else{
            interaction.editReply("Impossible de créer un compte. Rééssaye un peu plus tard !")
        }
    })
};

module.exports.createPlayer=createPlayer

const deletePlayer=async function(interaction){
    let user = interaction.user
    if (interaction.options.getUser("joueur")){
        if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
        else user=interaction.options.getUser("joueur")
    }
    let sql="DELETE FROM INVENTORY WHERE PLAYERID='"+user.id+"'"
    await db.delete(sql,()=>{})
    sql="DELETE FROM PLAYERS WHERE ID='"+user.id+"'"
    await db.delete(sql,(res)=>{
        interaction.editReply("Ton compte a bien été supprimé.")
    })
};

module.exports.deletePlayer=deletePlayer