const toFileString=function(txt){
    txt=txt.replaceAll(" ","_")
    txt=txt.replaceAll("(","").replaceAll(")","")
    txt=txt.replaceAll("&","_")
    txt=txt.replaceAll("?","_").replaceAll("!","_")

    txt=txt.replaceAll("à","a").replaceAll("ä","a").replaceAll("â","a")
    txt=txt.replaceAll("ç","c")
    txt=txt.replaceAll("é","e").replaceAll("è","e").replaceAll("ê","e")
    txt=txt.replaceAll("ï","i").replaceAll("î","i")

    return txt
}

module.exports.toFileString=toFileString