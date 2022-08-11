const { SlashCommandBuilder } = require('@discordjs/builders');
const permissions=require("./permissions")

const data = new SlashCommandBuilder()
    .setName('proba')
    .setDescription('Commandes liées aux probabilités')
    .addSubcommand(subcommand =>
        subcommand
            .setName('reset')
            .setDescription('Réinitialise les probabilités d\'obtention de cartes particulières (admin seulement)'))
    // .addSubcommand(subcommand =>
    //     subcommand
    //         .setName('rareté')
    //         .setDescription('Modifie la probabilité d\'une rareté. (admin seulement)')
    //         .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('carte')
            .setDescription('Modifie la probabilité d\'obtention d\'une carte (admin seulement)')
            .addStringOption(option => option.setName('carte').setDescription('La carte').setRequired(true))
            .addIntegerOption(option => option.setName('proba').setDescription('Probabilité entre 0 (inobtenable) et 100 (garantie)').setRequired(true)))

module.exports.data=data;

const db=require("../db.js")

const updateProba=async function(interaction){
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    let card=interaction.options.getString("carte")
    let proba=interaction.options.getInteger("proba")
    let sql="SELECT * FROM CARDS WHERE NAME='"+card+"'"
    await db.select(sql,(res)=>{
        if(res.length==1 ){
            db.update("UPDATE CARDS SET PROBAUP="+proba+" WHERE NAME='"+card+"'",()=>{
                interaction.editReply("Probabilité de "+card+" mise à jour !")
            });
        }else{
            interaction.editReply("La carte n'a pas été trouvée.")
        }
    })
};

module.exports.updateProba=updateProba

const resetProba=async function(interaction){
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    await db.update("UPDATE CARDS SET PROBAUP=NULL",()=>{})
    await interaction.editReply("Probabilités réinitialisées !")
};

module.exports.resetProba=resetProba