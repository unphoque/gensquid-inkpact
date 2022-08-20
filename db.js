const { Sequelize,QueryTypes } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: __dirname+'/gensquid_impact.db',
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    },
});

const select = async function(sql,callback){
    return await sequelize.query(sql, { type: QueryTypes.SELECT }).then(callback)
};

module.exports.select=select;

const insert = async function(sql,callback){
    return await sequelize.query(sql, { type: QueryTypes.INSERT }).then(callback)
};

module.exports.insert=insert;

const update = async function(sql,callback){
    return await sequelize.query(sql, { type: QueryTypes.UPDATE }).then(callback)
};

module.exports.update=update;

const del = async function(sql,callback){
    return await sequelize.query(sql, { type: QueryTypes.DELETE }).then(callback)
};

module.exports.delete=del;

const query = async function(sql){
    return await sequelize.query(sql).then((res)=> {
        return res
    });
}

module.exports.query=query;

async function test(){
    await del("DELETE FROM PLAYERS WHERE ID='360438506595549214'");
    await select("SELECT * from PLAYERS",console.log);
    await insert("INSERT INTO PLAYERS(ID,NAME) VALUES ('360438506595549214','un_phoque')",console.log);
    await select("SELECT * from PLAYERS",console.log);
    await update("UPDATE PLAYERS SET SEASNAILS=500 where ID='360438506595549214'")
    await select("SELECT * from PLAYERS",console.log);
}

//test()