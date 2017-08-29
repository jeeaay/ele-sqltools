const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
//const sqlite3 = require(process.resourcesPath+'/sql.asar/sqlite3.js')
const sqlite3 = require(path.join(__dirname,'../sql.asar/sqlite3.js'))
let win

function createWindow() {
    // 创建浏览器窗口。
    win = new BrowserWindow({ width: 860, height: 700 })

    // 加载应用的 index.html。
    win.loadURL(url.format({
        //pathname: path.join(__dirname, 'index.html'),
        pathname: path.join(__dirname, 'new.html'),
        protocol: 'file:',
        slashes: true
    }))

    // 打开开发者工具。
    win.webContents.openDevTools()


    // 当 window 被关闭，这个事件会被触发。
    win.on('closed', () => {
        // 取消引用 window 对象，如果你的应用支持多窗口的话，
        // 通常会把多个 window 对象存放在一个数组里面，
        // 与此同时，你应该删除相应的元素。
        win = null
    })
}

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.on('ready', createWindow)

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
    // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
    // 否则绝大部分应用及其菜单栏会保持激活。
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // 在这文件，你可以续写应用剩下主进程代码。
    // 也可以拆分成几个文件，然后用 require 导入。
    if (win === null) {
        createWindow()
    }
})

// 在这文件，你可以续写应用剩下主进程代码。
// 也可以拆分成几个文件，然后用 require 导入。

//计算数据库文章数
ipcMain.on('get-db-rows', (event, arg) => {
    let db = new sqlite3.Database(arg)
    db.get("select count(*) from Content",function (err,row) {
        for (let key in row) {
            if (row.hasOwnProperty(key)) {
                let element = row[key]
                console.log(element)
                event.sender.send('db-rows-reply', {"path":arg,"count":element});
            }
        }
    })
})
//开始数据处理
ipcMain.on('submit-data', (event, arg) => {
    //1. 初始化结果数据库，resfile为数据库路径 newdb为新数据库的sqlite3实例
    let {resfile,newdb} = setResDb(arg.dbList[0])
    //2. 合并数据，整合到新数据库的temp_Content
    for (let key in arg.dbList) {
        let db = new sqlite3.Database(arg.dbList[key])
        db.all("SELECT 标题,内容 FROM Content ORDER BY random()",(err, rows)=>{
            newdb.serialize(() => {
                newdb.run('BEGIN;');
                for(var i = 0; i < rows.length; i++) {
                    sql = "INSERT INTO temp_Content (title,content) VALUES('"+rows[i].标题.replace("'","\"")+"','"+rows[i].内容.replace("'","\"")+"')"
                    newdb.run(sql)
                }
                newdb.run('COMMIT');
            })
        })
        db.close()
    }

    event.sender.send('data-reply', {"file":resfile});
})


ipcMain.on('get-db-path', (event, arg) => {
    async () => {
        //初始化结果数据库
        let {resfile,newdb} =  await setResDb(arg[0])
        //遍历收到的所有要处理的数据库
        for (let key in arg) {
            let db = new sqlite3.Database(arg[key])
            db.all("SELECT 标题,内容 FROM Content ORDER BY random()",(err, rows)=>{
                newdb.serialize(() => {
                    
                    newdb.run('BEGIN;');
                    for(var i = 0; i < rows.length; i++) {
                        sql = "INSERT INTO temp_Content (title,content) VALUES('"+rows[i].标题.replace("'","\"")+"','"+rows[i].内容.replace("'","\"")+"')"
                        newdb.run(sql)
                    }
                    newdb.run('COMMIT');
                })
            })
            db.close()
        }
        event.sender.send('get-db-path-reply', {"file":resfile});
    }

    //event.returnValue = {"file":resfile}

})
//创建结果的数据库文件
async function setResDb (dbpath) {
    let date = new Date();
    let time = date.getFullYear() + "-" + (date.getMonth() < 10 ? '0' + (date.getMonth()+1) : (date.getMonth()+1)) + "-" + (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + "_" + date.getHours() + "-" + date.getMinutes() + "-" +date.getSeconds();
    let resfile = path.dirname(dbpath)+path.sep+time+".db"
    let db = new sqlite3.Database(resfile)
    await db.run("CREATE TABLE IF NOT EXISTS Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT,'title2' TEXT,'pub_time' INTEGER DEFAULT 0,'is_ping' DEFAULT 0)");
    await db.run("CREATE TABLE IF NOT EXISTS temp_Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT,'title2' TEXT,'pub_time' INTEGER DEFAULT 0,'is_ping' DEFAULT 0)");
    return {resfile:resfile,newdb:db}
}

//遍历收到的所有要处理的数据库，保存数据到新数据库的temp_Content
async function convertDb(dbList) {
    for (let key in dbList) {
        let db = new sqlite3.Database(dbList[key])
        db.all("SELECT 标题,内容 FROM Content ORDER BY random()",(err, rows)=>{
            newdb.serialize(() => {
                newdb.run('BEGIN;');
                for(var i = 0; i < rows.length; i++) {
                    sql = "INSERT INTO temp_Content (title,content) VALUES('"+rows[i].标题.replace("'","\"")+"','"+rows[i].内容.replace("'","\"")+"')"
                    newdb.run(sql)
                }
                newdb.run('COMMIT');
            })
        })
        db.close()
    }
}
