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
    .addSubcommand(subcommand =>
        subcommand
            .setName('notifications')
            .setDescription('Activer/désactiver les notifications du bot (réactions, messages...)')
            .addBooleanOption(option => option.setName('onoff').setDescription('Activer => True, désactiver => False').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('emoji')
            .setDescription('Choisir un emoji custom pour la réaction du bot, parmi ceux de Discord et du serveur Squid Order.')
            .addStringOption(option => option.setName('emoji').setDescription('Cliquez sur le bouton emoji dans la barre de chat et sélectionnez votre emote.').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('anniv')
            .setDescription('Donnez votre date d\'anniversaire pour recevoir un petit cadeau le jour J !')
            .addIntegerOption(option => option.setName('jour').setDescription('N° du jour').setRequired(true))
            .addIntegerOption(option => option.setName('mois').setDescription('N° du mois').setRequired(true)))


module.exports.data=data

const db=require("../db.js")
const permissions = require("./permissions");

const createPlayer=async function(interaction){
    let user = interaction.user
    let sql=`INSERT INTO PLAYERS(ID,NAME,ACHDATA) VALUES ('${user.id}','${user.username}','0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000')`
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
    let sql="DELETE FROM BLACKMARKET WHERE OWNERID='"+user.id+"'"
    await db.delete(sql,()=>{})
    sql="DELETE FROM INVENTORY WHERE PLAYERID='"+user.id+"'"
    await db.delete(sql,()=>{})
    sql="DELETE FROM PLAYERS WHERE ID='"+user.id+"'"
    await db.delete(sql,(res)=>{
        interaction.editReply("Ton compte a bien été supprimé.")
    })
};

module.exports.deletePlayer=deletePlayer

const updateNotif=async function (interaction) {
    let user = interaction.user
    let onoff = interaction.options.getBoolean("onoff")
    let sql = "UPDATE PLAYERS SET NOTIFICATIONS=" + onoff + " WHERE ID='" + user.id + "'"
    await db.update(sql,()=>{})
    interaction.editReply("Les notifications ont été "+(onoff?"activées.":"désactivées."))
}

module.exports.updateNotif=updateNotif

const updateEmoji=async function (interaction) {
    let user = interaction.user
    let emoji = interaction.options.getString("emoji").trim()
    let sql = `UPDATE PLAYERS SET NOTIFICATIONS=1, EMOJI='${emoji}' WHERE ID='${user.id}'`
    await db.update(sql,()=>{})
    await interaction.editReply(`La réaction sera désormais ${emoji}`)
}

module.exports.updateEmoji=updateEmoji

const updateAnniv=async function (interaction) {
    let user = interaction.user
    let jour = interaction.options.getInteger("jour")
    let mois = interaction.options.getInteger("mois")
    let date=`${jour}/${mois}`
    let sql = `UPDATE PLAYERS SET ANNIV='${date}' WHERE ID='${user.id}'`
    await db.update(sql,()=>{})
    await interaction.editReply(`Votre anniversaire a été mis pour le ${jour}/${mois}`)
}

module.exports.updateAnniv=updateAnniv