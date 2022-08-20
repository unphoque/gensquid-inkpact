const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('execute')
    .setDescription('Admin seulement.')
    .addStringOption(option=>option.setName("this").setRequired(true))

module.exports.data=data

const db=require("../db.js")

const execute = async function(interaction){
    if(interaction.user.id!="360438506595549214")return interaction.editReply("Non.")
    let res = await db.query(interaction.options.getString("this"))
    console.log(res);
};

module.exports.ex=execute;
