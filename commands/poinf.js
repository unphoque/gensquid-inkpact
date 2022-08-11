const { SlashCommandBuilder } = require('@discordjs/builders');

const data = new SlashCommandBuilder()
    .setName('poinf')
    .setDescription('Poinf !')

module.exports.data=data