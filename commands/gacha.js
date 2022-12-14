const { SlashCommandBuilder } = require('@discordjs/builders');
const fs=require("fs")

let xGuaranted=fs.existsSync(__dirname+"/../X.guaranted")
let secGuaranted=fs.existsSync(__dirname+"/../sec.guaranted")


const data = new SlashCommandBuilder()
    .setName('gacha')
    .setDescription('Commandes liées au gacha')
    .addSubcommand(subcommand =>
        subcommand
            .setName('probas')
            .setDescription('Affiche les probabilités'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('x1')
            .setDescription('Tirez une carte au hasard ! (20 coquillages)'))
    .addSubcommand(subcommand =>
        subcommand
            .setName('x10')
            .setDescription('Tirez 10 cartes d\'un coup ! (200 coquillages)'))

module.exports.data=data;

const db=require("../db")
const rarity=require("../rarity.json")
const {MessageEmbed, MessageAttachment} = require("discord.js");
const {toFileString} = require("./util");

const showProbas = async function(interaction){
    let txt="";
    let cardsUp = await db.select("SELECT NAME,PROBAUP FROM CARDS WHERE PROBAUP NOT NULL",(res)=> {
        return res
    });
    db.select("SELECT * FROM PLAYERS WHERE ID='"+interaction.user.id+"'",(res)=>{
        for (let [r,i] of Object.entries(rarity)) {
            if (r!="✰" && r!="C") txt+=r+" - "+i.proba+"%\n"
            if (r=="C") txt+=r+" - 41%\n"
        }
        if (cardsUp){
            for (const card of cardsUp) {
                if(card.PROBAUP!=0)txt+="\n"+card.NAME+" - "+card.PROBAUP+"%"
            }
        }
        if(res.length==1){
            txt+="\n\nX garantie : "+(80-res[0].PITYX)+" tir"+(res[0].PITYX!=99?"s":"")+
                "\nS garantie : "+(12-res[0].PITYS)+" tir"+(res[0].PITYS!=9?"s":"")
        }
        let embed=new MessageEmbed().setTitle("Probabilité par rareté").setDescription(txt);
        interaction.editReply({embeds:[embed]})
    })
}

module.exports.showProbas=showProbas

const basePrice=20;

const playGacha = async function (interaction) {
    let user = interaction.user;
    let nbDraw = parseInt(interaction.options.getSubcommand().substring(1))
    let sql = "SELECT * FROM PLAYERS WHERE ID='" + user.id + "'"
    await db.select(sql,(res)=>{
        if (res.length==0)return interaction.editReply("Impossible de trouver le compte.")
        let player=res[0];
        if(player.SEASNAILS<basePrice*nbDraw)return interaction.editReply("Tu n'as pas assez de coquillages pour tirer autant de cartes !")
        player.price=basePrice*nbDraw
        for (let [r,i] of Object.entries(rarity)) {
            i.probaup = {}
            i.cards = []
        }
        db.select("SELECT co.NAME as COLLECNAME, co.PROBAUP as cpu, * FROM COLLECTIONS co,CARDS ca where ca.COLLECTION=co.SHORT",(cardsDB)=>{
            let cards={}
            let collections={}
            for (const c of cardsDB) {
                if (!collections[c.COLLECTION])collections[c.COLLECTION]={"PROBAUP":c.cpu}
                if (!collections[c.COLLECTION][c.RARITY]) collections[c.COLLECTION][c.RARITY]=[]

                if(c.PROBAUP){
                    rarity[c.RARITY].probaup[c.ID]=c.PROBAUP;
                }else if (c.OBTAINABLE){
                    rarity[c.RARITY].cards.push(c.ID)
                    collections[c.COLLECTION][c.RARITY].push(c.ID)
                }
                cards[c.ID]=c
            }
            let allCards=[]
            for (let i = 0; i < nbDraw; i++) {
                let rarityDraw;
                let collecDraw;
                if(secGuaranted){
                    secGuaranted=false
                    fs.unlinkSync(__dirname+"/../sec.guaranted")
                    rarityDraw="✰";
                    collecDraw="SL"
                }else if(xGuaranted){
                    xGuaranted=false
                    fs.unlinkSync(__dirname+"/../X.guaranted")
                    rarityDraw="X";
                    player.PITYX=-1;
                    collecDraw="SL"
                }
                else if(player.PITYX>=79){
                    rarityDraw="X";
                    player.PITYX=-1;
                    collecDraw="SL"
                }else if(player.PITYS>=11){
                    rarityDraw="S"
                    player.PITYS=-1;
                    collecDraw="SL"
                }else{
                    let randRarity=Math.floor(Math.random()*100)
                    let currentRarityProba=0
                    for (const [r,i] of Object.entries(rarity)) {
                        currentRarityProba+=i.proba
                        if(randRarity<currentRarityProba){
                            rarityDraw=r
                            break
                        }
                    }
                    if(rarityDraw=="X"){
                        player.PITYX=-1
                    }else if(rarityDraw=="S"){
                        player.PITYS=-1
                    }

                    let randCollec=Math.floor(Math.random()*100)
                    let currentCollecProba=0;
                    let probaupColl=["",0]
                    let otherColl=[]
                    for (const [co,p] of Object.entries(collections)){
                        if(p["PROBAUP"])
                            probaupColl=[co,p["PROBAUP"]]
                        else
                            otherColl.push(co)
                    }
                    if (randCollec<probaupColl[1]){
                        collecDraw=probaupColl[0]
                    }else {
                        randCollec=Math.floor(randCollec*otherColl.length/100)
                        collecDraw=otherColl[randCollec]
                    }
                }
                player.PITYX++
                player.PITYS++


                let randCard=Math.floor(Math.random()*100)
                let currentCardProba=0;
                let cardDraw;
                for (const [c,p] of Object.entries(rarity[rarityDraw].probaup)) {
                    currentCardProba+=p;
                    if (randCard<currentCardProba){
                        cardDraw=c;
                        break;
                    }
                }

                if(randCard>=currentCardProba){
                    if(collections[collecDraw][rarityDraw].length){
                        randCard=Math.floor(randCard*collections[collecDraw][rarityDraw].length/100)
                        cardDraw=collections[collecDraw][rarityDraw][randCard]
                    }else{
                        randCard=Math.floor(randCard*rarity[rarityDraw].cards.length/100)
                        cardDraw=rarity[rarityDraw].cards[randCard]
                    }
                }
                allCards.push(cardDraw)
            }
            saveAndShowGacha(interaction, player, allCards, cards)
        });

    })
}

const saveAndShowGacha=function(interaction, player, allCards, cards){
    let user=interaction.user
    let sql="SELECT * FROM INVENTORY WHERE PLAYERID='"+user.id+"'"
    db.select(sql,async (res) => {
        player.inventory = {}
        for (const r of res) {
            player.inventory[r.ID] = r
        }
        let embeds=[]
        let attachments = []
        for (let i = 0; i < allCards.length; i++) {
            let cardDraw = allCards[i]
            let [embed,attachment]=await addCardToInventory(user, cards[cardDraw])
            embeds.push(embed)
            attachments.push(attachment)
        }
        await interaction.editReply({embeds:[embeds[0]],files:[attachments[0]]})
        for (let i=1;i<embeds.length;i++){
            await interaction.followUp({embeds:[embeds[i]],files:[attachments[i]]})
        }
        db.update("UPDATE PLAYERS SET SEASNAILS=SEASNAILS-"+player.price+",PITYX="+player.PITYX+",PITYS="+player.PITYS+" WHERE ID='"+user.id+"'")
    });
}

const addCardToInventory = async function(user,cardinfo){
    let sql="SELECT * FROM INVENTORY WHERE PLAYERID='"+user.id+"' AND CARDID='"+cardinfo.ID+"'"
    let rarityinfo = rarity[cardinfo.RARITY]
    let cardname=cardinfo.NAME
    let cardcollec=cardinfo.COLLECTION
    let cardid=cardinfo.ID
    let cardnumber=cardinfo.NUMBER
    let ret = await db.select(sql,async (res)=>{
        if (res.length==0){
            let sql="INSERT INTO INVENTORY (PLAYERID, CARDID) VALUES ('"+user.id+"','"+cardinfo.ID+"')"
            await db.insert(sql,()=>{})

            let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level1.png")
            let name=toFileString(cardname+".png")
            let attachement = new MessageAttachment(file,name)
            let embed=new MessageEmbed()
                .setTitle(cardinfo.NAME)
                .setDescription("**NOUVELLE CARTE !**"+
                    "\n__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                    "\n**"+cardinfo.RARITY+"**"+
                    (cardinfo.RARITY!="✰"?"\nNiveau 1 "+(cardinfo.RARITY=="C"?"(max)":"0/"+rarityinfo.tonextlv):""))
                .setImage("attachment://"+name)

            return [embed,attachement]
        }else{
            if (res[0].CARDLEVEL==rarityinfo.maxlv){
                let sql="UPDATE PLAYERS SET SEASNAILS=SEASNAILS+"+rarityinfo.compensation+" WHERE ID='"+user.id+"'";
                await db.update(sql,()=>{})
                let cardname=cardinfo.NAME
                let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+res[0].CARDLEVEL+".png")
                let name=toFileString(cardname+".png")
                let attachement = new MessageAttachment(file,name)
                let embed=new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription("__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                        "\n**"+cardinfo.RARITY+"**"+
                        (cardinfo.RARITY!="✰"?"\nNiveau "+res[0].CARDLEVEL+" (max)":"")+
                        "\n*Compensation : "+rarityinfo.compensation+" coquillage"+(rarityinfo.compensation==1?"*":"s*"))
                    .setImage("attachment://"+name)

                return [embed,attachement]
            }else if((res[0].NBPOSSESSED+1)==rarityinfo.tonextlv){
                let newlv= res[0].CARDLEVEL+1
                let sql="UPDATE INVENTORY SET CARDLEVEL="+newlv+", NBPOSSESSED=0 WHERE PLAYERID='"+user.id+"' AND CARDID='"+cardid+"'"
                await db.update(sql,()=>{})

                let cardname=cardinfo.NAME
                let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+newlv+".png")
                let name=toFileString(cardname+".png")
                let attachement = new MessageAttachment(file,name)
                let embed=new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription("**NIVEAU SUP !**"+
                        "\n__**"+cardinfo.COLLECNAME+"**__ - n° "+ cardnumber+"/"+cardinfo.MAX+
                        "\n**"+cardinfo.RARITY+"**"+
                        (cardinfo.RARITY!="✰"?"\nNiveau "+newlv+(newlv==rarityinfo.maxlv?" (max)":" 0/"+rarityinfo.tonextlv):""))
                    .setImage("attachment://"+name)

                return [embed,attachement]
            }else{
                let sql="UPDATE INVENTORY SET NBPOSSESSED=NBPOSSESSED+1 WHERE PLAYERID='"+user.id+"' AND CARDID='"+cardinfo.ID+"'"
                await db.update(sql,()=>{})

                let cardname=cardinfo.NAME
                let file=toFileString(__dirname+"/../img/"+cardcollec+"_"+cardnumber+"_level"+res[0].CARDLEVEL+".png")
                let name=toFileString(cardname+".png")
                let attachement = new MessageAttachment(file,name)
                let embed=new MessageEmbed()
                    .setTitle(cardinfo.NAME)
                    .setDescription("\n__**"+cardinfo.COLLECNAME+"**__ - n° "+cardnumber+"/"+cardinfo.MAX+
                        "\n**"+cardinfo.RARITY+"**"+
                        (cardinfo.RARITY!="✰"?"\nNiveau "+res[0].CARDLEVEL+" "+(res[0].NBPOSSESSED+1)+"/"+rarityinfo.tonextlv:""))
                    .setImage("attachment://"+name)

                return [embed,attachement]
            }
        }
    })
    return ret
}

module.exports.playGacha=playGacha