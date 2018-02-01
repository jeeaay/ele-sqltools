const {ipcRenderer} = require('electron')
const path = require('path')
//读取缓存的关键词路径
var keywordFileArr = new Array
if (localStorage.keywordFileArr) {
    keywordFileArr = localStorage.getItem("keywordFileArr").split(",");
    $(".add-keyword-opt h3").hide()
    for(let value of keywordFileArr){
        $(".add-keyword-opt ul").append("<li>"+path.basename(value)+"</li>")
    }
}
//读取缓存的关键词路径
var dateFile
if (localStorage.dateFile) {
    dateFile = localStorage.getItem("dateFile");
    $(".datefile-list h3").hide()
    $(".datefile-list ul").html("<li>"+path.basename(dateFile)+"</li>")
}

//选项显示、隐藏
$(".panel").hide()
$("#submit").attr("disabled",true)
$(".is-rand-time .button").click(function (){
    if ($(this).children().val()==1) {
        $(".rand-time-opt").slideDown(100)
    }
    if ($(this).children().val()==0) {
        $(".rand-time-opt").slideUp(100)
    }
})

$(".is-div-db .button").click(function (){
    if ($(this).children().val()==1) {
        $(".div-db-opt").slideDown(100)
    }
    if ($(this).children().val()==0) {
        $(".div-db-opt").slideUp(100)
    }
})
//清除关键词文件
$("#clear-keyword-list").click(function () {
    $(".add-keyword-opt ul").html("")
    $(".add-keyword-opt h3").show()
    keywordFileArr = []
    localStorage.removeItem("keywordFileArr")
})
//清除日期文件
$("#clear-datefile-list").click(function () {
    $(".datefile-list ul").html("")
    $(".datefile-list h3").show()
    dateFile = ""
    localStorage.removeItem("dateFile")
})
//reset
$("#reset").click(function () {
    location.reload()
})

//拖放关键词文件
const keywordHolder = document.getElementsByClassName('add-keyword-opt')[0]
keywordHolder.ondragover = () => {
    $(".add-keyword-opt").addClass("hover")
    return false;
}
keywordHolder.ondragleave = keywordHolder.ondragend = () => {
    $(".add-keyword-opt").removeClass("hover")
    return false;
}
keywordHolder.ondrop = (e) => {
    e.preventDefault()
    let reg = /^(.*)\.txt$/
    $(".add-keyword-opt").removeClass("hover")
    for (let f of e.dataTransfer.files) {
        if (!f.path.match(reg)) {
            alert("仅支持txt格式的文件");
            return false;
        }
        $(".add-keyword-opt h3").hide()
        $(".add-keyword-opt ul").append("<li>"+path.basename(f.path)+"</li>")
        keywordFileArr.push(f.path)
        localStorage.setItem("keywordFileArr",keywordFileArr.toString())
    }
    return false;
}
//拖放日期文件
const datefileHolder = document.getElementsByClassName('datefile-list')[0]
datefileHolder.ondragover = () => {
    $(".datefile-list").addClass("hover")
    return false;
}
datefileHolder.ondragleave = datefileHolder.ondragend = () => {
    $(".datefile-list").removeClass("hover")
    return false;
}
datefileHolder.ondrop = (e) => {
    e.preventDefault()
    let reg = /^(.*)\.txt$/
    $(".datefile-list").removeClass("hover")
    for (let f of e.dataTransfer.files) {
        if (!f.path.match(reg)) {
            alert("仅支持txt格式的文件");
            return false;
        }
        $(".datefile-list h3").hide()
        $(".datefile-list ul").html("<li>"+path.basename(f.path)+"</li>")
        dateFile = f.path
        localStorage.setItem("dateFile",dateFile)
    }
    return false;
}

//拖放数据库
var dbArr = new Array
var dbRowsCount = 0
const dbHolder = document.getElementsByClassName('db-holder')[0]
dbHolder.ondragover = () => {
    $(".db-holder").addClass("hover")
    return false;
}
dbHolder.ondragleave = dbHolder.ondragend = () => {
    $(".db-holder").removeClass("hover")
    return false;
}
dbHolder.ondrop = (e) => {
    e.preventDefault()
    let reg = /^(.*)\.db3$/
    $(".db-holder").removeClass("hover")
    $(".dialog-mask h3").html("正在计算")
    for (let f of e.dataTransfer.files) {
        //判断后缀
        if (!f.path.match(reg)) {
            alert("仅支持db3后缀的文件")
            return false
        }
        //显示loading
        $("#submit").attr("disabled",false)
        $(".dialog-mask").show()
        $(".panel").show()
        //异步通信，返回时调用db-rows-reply事件
        ipcRenderer.send('get-db-rows', f.path)
    }
    return false;
}
//异步通信，返回结果处理
ipcRenderer.on('db-rows-reply', function(event, arg) {
    //计算总数
    dbRowsCount +=arg.count
    //隐藏提示文字
    $(".db-holder h3").hide()
    //展示数据库名
    $(".db-holder ul").append("<li>"+path.basename(arg.path)+"</li>")
    //保存到dbArr
    dbArr.push(arg.path)
    //隐藏loading
    $(".dialog-mask").hide()
})

//计算已发、未发的布文章
$("#publish-count").keyup(function () {
    $("#publish-count").val($("#publish-count").val().trim())
    if (dbRowsCount - $("#publish-count").val() < 0) {
        $("#publish-count").val(dbRowsCount);
        $("#future-count").val(0);
    } else {
        $("#future-count").val(dbRowsCount - $("#publish-count").val());
    }
})
$("#future-count").keyup(function () {
    $("#future-count").val($("#future-count").val().trim())
    if (dbRowsCount - $("#future-count").val() < 0) {
        $("#future-count").val(dbRowsCount);
        $("#publish-count").val(0);
    } else {
        $("#publish-count").val(dbRowsCount - $("#future-count").val());
    }
})

//计算数据库分割
$("#posts-in-every-db").keyup(function () {
    $("#posts-in-every-db").val($("#posts-in-every-db").val().trim())
    if ($("#posts-in-every-db").val()) {
        let dbCount = Math.ceil(dbRowsCount / $("#posts-in-every-db").val());
        $("#db-count").val(dbCount);
    } else {
        $("#db-count").val("");
    }
})
$("#db-count").keyup(function () {
    $("#db-count").val($("#db-count").val().trim())
    if ($("#db-count").val()) {
        let postsCount = Math.ceil(dbRowsCount / $("#db-count").val());
        $("#posts-in-every-db").val(postsCount);
    } else {
        $("#posts-in-every-db").val("");
    }
})

//提交选项
$("#submit").click(function () {
    //需要提交的数据保存到一个对象中
    var subData = {
        dbRowsCount:dbRowsCount,
        dbList:dbArr,
        keywordFileArr:keywordFileArr,
        dateFile:dateFile
    }
    //表单验证
    if ( $("input[name=rand-time]:checked").val() == 1 ) {
        if($("#publish-count").val()=="" && $("#future-count").val()==""){
            $("#publish-count").focus()
            alert("您选择了[添加随机时间]而未填写数量")
            return false
        }
        subData.randTime = {
            publishCount : $("#publish-count").val()=="" ? 0 : $("#publish-count").val(),
            publishDay : $("#publish-day").val()=="" ? 20 : $("#publish-day").val(),
            futureCount : $("#future-count").val()=="" ? 0 : $("#future-count").val(),
            futureDay : $("#future-day").val()=="" ? 20 : $("#future-day").val()
        }
    }
    if ( $("input[name=div-db]:checked").val() == 1 ) {
        if($("#posts-in-every-db").val()=="" || $("#db-count").val()==""){
            $("#posts-in-every-db").focus()
            alert("您选择了[分割数据库]而未填写分割数量")
            return false
        }
        subData.dbDiv = {
            postsInEverydb : $("#posts-in-every-db").val(),
            dbCount : $("#db-count").val()
        }
    }
    if ( $("input[name=skip-time]:checked").val() == 1 ) {
        subData.timeskip = 1
    }
    
    //console.log(subData)
    $(".dialog-mask h3").html("处理中")
    $(".dialog-mask").show()
    //异步通信，全部处理完时调用data-reply事件
    ipcRenderer.send('submit-data', subData)

})
//展示当前处理信息
ipcRenderer.on('step-reply', function(event, arg) {
    console.log(arg)
    $(".dialog-mask h3").html(arg.title)
})
//异步通信，后台处理结束时，返回结果处理
ipcRenderer.on('data-reply', function(event, arg) {
    alert("处理完毕")
    $(".dialog-mask h3").html("处理完毕！")
    $(".msg div").hide()
    $(".msg").append("<p>结果保存在:</p>")
    $(".msg").append("<p>" +arg.file+ "</p>")
    $(".msg").append("<p>([点击]任意处继续)</p>")
    $(".dialog-mask").click(function () {
        location.reload()
    })
})

ipcRenderer.on('console-reply', function(event, arg) {
    console.log("1")
    console.log(arg)
})