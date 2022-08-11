const { SlashCommandBuilder } = require('@discordjs/builders');
const permissions=require("./permissions")

const data = new SlashCommandBuilder()
    .setName('solde')
    .setDescription('Affiche votre solde de coquillages !')
    .addSubcommand(subcommand =>
        subcommand
            .setName('moi')
            .setDescription('Affiche votre solde de coquillages !'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('joueur')
            .setDescription('Affiche le solde d\'un autre joueur (admin seulement)')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('set')
            .setDescription('Modifie le solde d\'un joueur (admin seulement)')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true))
            .addIntegerOption(option => option.setName('coquillages').setDescription('Nouveau solde').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('add')
            .setDescription('Ajoute des coquillages au solde d\'un joueur (admin seulement)')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true))
            .addIntegerOption(option => option.setName('coquillages').setDescription('Nombre de coquillages').setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('remove')
            .setDescription('Retire des coquillages du solde d\'un joueur (admin seulement)')
            .addUserOption(option => option.setName('joueur').setDescription('Le joueur').setRequired(true))
            .addIntegerOption(option => option.setName('coquillages').setDescription('Nombre de coquillages').setRequired(true)))

module.exports.data=data;

const db=require("../db.js")

const showSolde=async function(interaction){
    let user = interaction.user
    if (interaction.options.getUser("joueur")) {
        if(permissions.includes(user.id)) user = interaction.options.getUser("joueur")
        else return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    }
    let sql="SELECT SEASNAILS FROM PLAYERS WHERE ID='"+user.id+"'"
    await db.select(sql,(res)=>{
        if(res.length==1 && user.id == interaction.user.id){
            interaction.editReply("Tu possèdes "+res[0].SEASNAILS+" coquillages !")
        }
        else if(res.length==1){
            interaction.editReply(user.toString()+" possèdes "+res[0].SEASNAILS+" coquillages.")
        }
        else{
            interaction.editReply("Impossible de trouver le compte.")
        }
    })
};

module.exports.showSolde=showSolde

const setSoldeDB = async function(interaction,user,seasnails){
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    let sql="UPDATE PLAYERS SET SEASNAILS="+seasnails+" WHERE ID='"+user.id+"'"
    await db.update(sql,(res)=>{
        if(res[1]==1){
            interaction.editReply(user.toString()+" possède désormais "+seasnails+" coquillages.")
        }else{
            interaction.editReply("Impossible de trouver le compte.")
        }
    })
}

const setSolde=async function(interaction){
    let user=interaction.options.getUser("joueur")
    let seasnails = interaction.options.getInteger("coquillages")
    await setSoldeDB(interaction,user,seasnails)
};

module.exports.setSolde=setSolde

const addSolde=async function(interaction){
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    let user=interaction.options.getUser("joueur")
    let seasnails = interaction.options.getInteger("coquillages")
    await db.select("SELECT SEASNAILS FROM PLAYERS WHERE ID='"+user.id+"'",(res)=>{
        if(res.length==1){
            seasnails=res[0].SEASNAILS+seasnails
            setSoldeDB(interaction,user,seasnails)
        }
        else{
            interaction.editReply("Impossible de trouver le compte.")
        }
    });
};

module.exports.addSolde=addSolde

const remSolde=async function(interaction){
    if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
    let user=interaction.options.getUser("joueur")
    let seasnails = interaction.options.getInteger("coquillages")
    await db.select("SELECT SEASNAILS FROM PLAYERS WHERE ID='"+user.id+"'",(res)=>{
        if(res.length==1){
            seasnails=res[0].SEASNAILS-seasnails
            setSoldeDB(interaction,user,seasnails)
        }
        else{
            interaction.editReply("Impossible de trouver le compte.")
        }
    });
};

module.exports.remSolde=remSolde