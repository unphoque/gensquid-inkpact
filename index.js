const CONFIG = require("./config.json")

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs')


const commands = [];
const commandFiles = fs.readdirSync(__dirname+'/commands/').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if(command.data) commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(CONFIG.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        /*await rest.put(
            Routes.applicationGuildCommands(CONFIG.CLIENT_ID,CONFIG.GUILD_ID),
            { body: [] },
        );*/
        await rest.put(
            Routes.applicationGuildCommands(CONFIG.CLIENT_ID,CONFIG.GUILD_ID),
            { body: commands },
        );

        //console.dir(commands)

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

//application
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });

const db=require("./db");
const rarity=require("./rarity.json");
db.select("SELECT * FROM RARITY",(res) => {
    for (const r of res) {
        rarity[r.NAME].proba = r.PROBA;
    }
    fs.writeFile("./rarity.json", JSON.stringify(rarity),"utf8",()=>console.log("Rarities updated"));

});

const solde=require("./commands/solde")
const joueur=require("./commands/joueur")
const carte=require("./commands/carte")
const gacha=require("./commands/gacha")
const proba=require("./commands/proba")
const echange=require("./commands/echange")
const execute=require("./commands/execute")

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    if (CONFIG.IS_INVISIBLE) {
        client.user.setPresence({status: "invisible"})
        client.user.setActivity(CONFIG.STATUS,{type:ActivityType.Custom})
    }
});

//MESSAGE
client.on("messageCreate", async message => {

    let res = await db.select("SELECT * FROM PLAYERS WHERE ID='"+message.author.id+"'",(res)=> {return res})
    if (res.length==0)return
    else{
        let d=new Date().getTime()
        if (res[0].LASTMESSAGE<d-3600000 && res[0].TOTALTODAY<5){
            try{
                if(res[0].NOTIFICATIONS)await message.react("🐚")
                let rand=Math.floor(Math.random()*100)
                let added=4
                if (rand<5)added=20
                if (rand==0)added=200
                await db.update("UPDATE PLAYERS SET SEASNAILS=SEASNAILS+"+added+", TOTALTODAY=TOTALTODAY+1, LASTMESSAGE="+d+" WHERE ID='"+message.author.id+"'", ()=>{});
            }catch (e) {

            }
        }
    }
});

const reloadAtMidnight=function(){
    db.update("UPDATE PLAYERS SET TOTALTODAY=0");
    timer=setInterval(function(){db.update("UPDATE PLAYERS SET TOTALTODAY=0");},86400000)
};

let today = new Date();
let tommorow = new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
let timeToMidnight = (tommorow-today);
let timer = setTimeout(reloadAtMidnight,timeToMidnight);

//COMMANDS
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    if (interaction.commandName === 'poinf')await interaction.reply("miu miu")
    if (interaction.commandName === 'solde') {
        switch (interaction.options.getSubcommand()){
            case "moi":
            case "joueur":
                await interaction.deferReply({ephemeral:true});
                await solde.showSolde(interaction)
                break
            case "set":
                await interaction.deferReply({ephemeral:true});
                await solde.setSolde(interaction)
                break
            case "add":
                await interaction.deferReply({ephemeral:true});
                await solde.addSolde(interaction)
                break
            case "remove":
                await interaction.deferReply({ephemeral:true});
                await solde.remSolde(interaction)
                break
        }
    }else if(interaction.commandName=="joueur"){
        switch (interaction.options.getSubcommand()) {
            case "créer":
                await interaction.deferReply({ephemeral:true});
                await joueur.createPlayer(interaction)
                break
            case "suppr":
            case "ban":
                await interaction.deferReply({ephemeral:true});
                await joueur.deletePlayer(interaction)
                break
            case "notifications":
                await interaction.deferReply({ephemeral:true});
                await joueur.updateNotif(interaction)
                break
        }
    }else if(interaction.commandName=="carte"){
        switch (interaction.options.getSubcommand()){
            case "voir":
                await interaction.deferReply();
                await carte.showCard(interaction)
                break
            case "liste":
            case "joueur":
                await interaction.deferReply({ephemeral:true});
                await carte.showAllCards(interaction)
                break
            case "give":
                await interaction.deferReply();
                await carte.giveCard(interaction)
                break
        }
    }else if(interaction.commandName=="gacha"){
        switch (interaction.options.getSubcommand()){
            case "probas":
                await interaction.deferReply({ephemeral:true});
                await gacha.showProbas(interaction)
                break
            case "x1":
            case "x10":
                await interaction.deferReply();
                await gacha.playGacha(interaction)
                break
        }
    }else if(interaction.commandName=="proba"){
        switch (interaction.options.getSubcommand()){
            case "carte":
                await interaction.deferReply({ephemeral:true});
                await proba.updateProba(interaction)
                break
            case "reset":
                await interaction.deferReply({ephemeral:true});
                await proba.resetProba(interaction)
                break
        }
    }else if(interaction.commandName=="échange"){
        await interaction.deferReply({ephemeral:true});
        await echange.createExchange(interaction)
    }else if(interaction.commandName=="execute"){
        await interaction.deferReply({ephemeral:true});
        await execute.ex(interaction);
    }
});

//BUTTONS
client.on("interactionCreate",async interaction=>{
    if (!interaction.isButton()) return;

    if (interaction.customId.includes("ex_ok")){
        await interaction.deferReply();
        await echange.executeExchange(interaction);
    }
});

//SELECT MENUS
client.on("interactionCreate", async interaction=>{
   if (!interaction.isSelectMenu()) return;

   if (interaction.customId.includes("voir_")){
       await interaction.deferReply({ephemeral:true});
       await carte.showCardSelectMenu(interaction);
   }
});

client.login(CONFIG.DISCORD_TOKEN);