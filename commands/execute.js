const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('execute')
    .setDescription('Admin seulement.')
    .addStringOption(option=>optio)

module.exports.data=data

const db=require("../db.js")

const execute = async function(interaction){
    let res = await db.query(interaction.options)
    console.log(res);
};
