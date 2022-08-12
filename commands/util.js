const toFileString=function(txt){
    txt=txt.replaceAll(" ","_")
    txt=txt.replaceAll("(","").replaceAll(")","")
    txt=txt.replaceAll("&","")

    txt=txt.replaceAll("à","a").replaceAll("ä","a")
    txt=txt.replaceAll("ç","c")
    txt=txt.replaceAll("é","e").replaceAll("è","e")
    txt=txt.replaceAll("ï","i")

    return txt
}

module.exports.toFileString=toFileString