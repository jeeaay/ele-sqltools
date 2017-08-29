const {ipcRenderer} = require('electron')
const path = require('path')

//选项显示、隐藏
$(".is-rand-time .button").click(function (){
    if ($(this).children().val()==1) {
        $(".rand-time-opt").slideDown(100)
    }
    if ($(this).children().val()==0) {
        $(".rand-time-opt").slideUp(100)
    }
})
$(".add-keyword-opt").hide()
$(".panel").hide()
$(".is-add-keyword .button").click(function (){
    if ($(this).children().val()==1) {
        $(".add-keyword-opt").slideDown(100)
    }
    if ($(this).children().val()==0) {
        $(".add-keyword-opt").slideUp(100)
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
//清除关键词选择
$("#clear-keyword-list").click(function () {
    $(".add-keyword-opt ul").html("")
    $(".add-keyword-opt h3").show()
    $("#keyword-files").val("")
})
//reset
$("#reset").click(function () {
    location.reload()
})

//拖放关键词文件
var keywordFileArr = new Array
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
    for (let f of e.dataTransfer.files) {
        if (!f.path.match(reg)) {
            alert("仅支持txt格式的文件");
            return false;
        }
        $(".add-keyword-opt h3").hide()
        $(".add-keyword-opt ul").append("<li>"+path.basename(f.path)+"</li>")
        keywordFileArr.push(f.path)  
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
    $(".panel").show()
    $(".db-holder").removeClass("hover")
    let reg = /^(.*)\.db3$/
    $(".dialog-mask h3").html("正在计算")
    for (let f of e.dataTransfer.files) {
        //显示loading
        $(".dialog-mask").show()
        //判断后缀
        if (!f.path.match(reg)) {
            alert("仅支持db3后缀的文件");
            return false;
        }
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
    $("#publish-count").val($.trim($("#publish-count").val()))
    if (dbRowsCount - $("#publish-count").val() < 0) {
        $("#publish-count").val(dbRowsCount);
        $("#future-count").val(0);
    } else {
        $("#future-count").val(dbRowsCount - $("#publish-count").val());
    }
})
$("#future-count").keyup(function () {
    $("#future-count").val($.trim($("#future-count").val()))
    if (dbRowsCount - $("#future-count").val() < 0) {
        $("#future-count").val(dbRowsCount);
        $("#publish-count").val(0);
    } else {
        $("#publish-count").val(dbRowsCount - $("#future-count").val());
    }
})

//计算数据库分割
$("#posts-in-every-db").keyup(function () {
    $("#posts-in-every-db").val($.trim($("#posts-in-every-db").val()))
    if ($("#posts-in-every-db").val()) {
        let dbCount = Math.ceil(dbRowsCount / $("#posts-in-every-db").val());
        $("#db-count").val(dbCount);
    } else {
        $("#db-count").val("");
    }
})
$("#db-count").keyup(function () {
    $("#db-count").val($.trim($("#db-count").val()))
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
        dbList:dbArr,
        keywordFileArr:keywordFileArr
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
            postsinEverydb : $("#posts-in-every-db").val(),
            dbCount : $("#db-count").val()
        }
    }
    console.log(subData)
    $(".dialog-mask h3").html("处理中")
    $(".dialog-mask").show()
    //异步通信，返回时调用data-reply事件
    ipcRenderer.send('submit-data', subData)
})
//异步通信，后台处理结束时，返回结果处理
ipcRenderer.on('data-reply', function(event, arg) {
    $(".dialog-mask").hide()
    console.log(arg)
})