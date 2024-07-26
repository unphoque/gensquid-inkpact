const CONFIG=require("config.json")

const express=require("express")
const permissions = require("./commands/permissions");
const db = require("./db");
const {MessageEmbed} = require("discord.js");
const app=express()
app.listen(CONFIG.PORT, () => console.log(`App listening at https://unphoque.fr:${CONFIG.PORT}`));

app.get('/so/inventory', async  (req, res) => {
    let user = interaction.user
    if (interaction.options.getUser("joueur")) {
        if(!permissions.includes(interaction.user.id)) return interaction.editReply("Vous n'avez pas la permission pour exécuter cette commande.")
        else user = interaction.options.getUser("joueur")
    }
    let collec=""
    try {
        collec=interaction.options.getString("collection")
    } catch (e) {}
    let sql=`SELECT * FROM CARDS, INVENTORY WHERE PLAYERID='${user.id}' AND ID=CARDID ${collec?`AND COLLECTION='${collec}'`:""} ORDER BY CARDID`
    await db.select(sql,(res)=>{
        for (let i = 0; i < res.length; i++) {
            let c=res[i]
            desc+=c.NAME+" - "+c.RARITY+" Lv "+c.CARDLEVEL+" - x"+c.QUANTITY+"\n"
        }
    });
});

app.get('/img/*', async (res, req)=>{

})

