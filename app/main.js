const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const fs = require("fs")
    //const sqlite3 = require(process.resourcesPath+'/sql.asar/sqlite3.js')
const sqlite3 = require(path.join(__dirname, '../sql.asar/sqlite3.js'))
let win

function createWindow() {
    // 创建浏览器窗口。
    win = new BrowserWindow({ width: 860, height: 700 })

    // 加载应用的 index.html。
    win.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }))

    // 打开开发者工具。
    //win.webContents.openDevTools()


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
    db.get("select count(*) from Content", function(err, row) {
        for (let key in row) {
            if (row.hasOwnProperty(key)) {
                let element = row[key]
                event.sender.send('db-rows-reply', { "path": arg, "count": element });
            }
        }
    })
})

//开始数据处理
ipcMain.on('submit-data', async(event, arg) => {
    //1. 初始化结果数据库，resfile为数据库路径 newdb为新数据库的sqlite3实例
    event.sender.send('step-reply', { "title": "正在初始化数据库" });
    let { resfile, newdb } = setResDb(arg.dbList[0])

    //2. 合并数据，整合到新数据库的temp_Content表
    for (let value of arg.dbList) {
        event.sender.send('step-reply', { "title": "正在处理数据库：" + path.basename(value) });
        let db = new sqlite3.Database(value)
        await convertDb(db, newdb)
        db.close()
    }

    //3. 打乱顺序，存入Content表
    event.sender.send('step-reply', { "title": "正在生成Content表" });
    await randOrder(newdb)
        
    //4. 添加随机时间和附加标题
    if (arg.keywordFileArr.length || arg.randTime) {
        event.sender.send('step-reply', { "title": "正在添加随机时间/标题" });
        await addToDb(newdb, arg)
    }

    //5. 分割数据库
    if (arg.dbDiv) {
        event.sender.send('step-reply', { "title": "正在分割数据库" });
        resfile = path.normalize(resfile.replace(path.extname(resfile),""))
        fs.mkdirSync(resfile)
        //拆分步骤为多个Promise?
        // 5.1 初始化临时表
        await initTempTable(newdb)
        // 5.2 储存分割后的数据
        for (let i = 0; i < arg.dbDiv.dbCount; i++) {
            await saveDivDb(i, newdb, resfile, arg.dbDiv.postsInEverydb, event)
        }
        
        //await divDb(newdb, resfile, arg.dbDiv, event)
    }
    
    event.sender.send('step-reply', { "title": "即将完成：正在清理无用数据" });
    //清理、结束
    await vacuumDb(newdb)
    newdb.close()
    event.sender.send('data-reply', { "file": resfile });
    
})

//初始化数据库
const setResDb = (dbpath) => {
    let date = new Date();
    let time = date.getFullYear() + "-" + (date.getMonth() < 10 ? '0' + (date.getMonth() + 1) : (date.getMonth() + 1)) + "-" + (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + "_" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds();
    let resfile = path.dirname(dbpath) + path.sep + time + ".db"
    let db = new sqlite3.Database(resfile)
    db.run("CREATE TABLE IF NOT EXISTS Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT,'title2' TEXT,'pub_time' INTEGER DEFAULT 0,'is_ping' DEFAULT 0);");
    db.run("CREATE TABLE IF NOT EXISTS temp_Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT);");
    return { resfile: resfile, newdb: db }
}

//保存数据到新数据库的temp_Content
const convertDb = (db, newdb) => new Promise((res, rej) => {
    db.all("SELECT 标题,内容 FROM Content ", (err, rows) => {
        newdb.serialize(() => {
            newdb.run('BEGIN;');
            for (var i = 0; i < rows.length; i++) {
                if (rows[i].标题 && rows[i].内容) {
                    sql = "INSERT INTO temp_Content (title,content) VALUES('" + rows[i].标题.replace(/[\'|’]/g, "\"") + "','" + rows[i].内容.replace(/[\'|’]/g, "\"") + "')"
                    newdb.run(sql)
                }
            }
            newdb.run('COMMIT', res);
        })
    })
});

//打乱顺序后存入Content表
const randOrder = (db) => new Promise((res, rej) => {
    db.serialize(() => {
        db.run('BEGIN;');
        db.run("INSERT INTO Content (`title`,`content`) SELECT `title`,`content` FROM 'temp_Content' ;")
        db.run("DROP TABLE temp_Content;")
        db.run('COMMIT', res)
    })
});

// 5.1初始化临时表
const initTempTable = (db) => new Promise((res, rej) => {
    db.serialize(() => {
        db.run('BEGIN;');
        db.run("CREATE TABLE IF NOT EXISTS temp_Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT,'title2' TEXT,'pub_time' INTEGER DEFAULT 0);")
        db.run("INSERT INTO temp_Content (`title`,`content`,`pub_time`,`title2`) SELECT `title`,`content`,`pub_time`,`title2` FROM 'Content' ORDER BY random();")
        db.run('COMMIT',res)
    })
});
// 5.2储存分割后的数据
const saveDivDb = (i, db, resfile, postsInEverydb, event) => new Promise((res, rej) => {
    event.sender.send('step-reply', { "title": "分割：正在生成第"+(i+1)+"个数据库" });
    resDb = new sqlite3.Database(resfile + path.sep + String(i+1) + ".db")
    resDb.run("CREATE TABLE IF NOT EXISTS Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT,'title2' TEXT,'pub_time' INTEGER DEFAULT 0,'is_ping' DEFAULT 0);",()=>{
        db.all("SELECT * FROM temp_Content where ID > " + (i*postsInEverydb) + " AND ID < " + ((i+1)*postsInEverydb) + " ORDER BY pub_time",async (err, rows) => {
            resDb.serialize(() => {
                resDb.run('BEGIN;');
                for(let value of rows){
                    resDb.run("INSERT INTO Content (`title`,`content`,`title2`,`pub_time`) VALUES('" + value.title + "','" + value.content + "','" + value.title2 + "'," + value.pub_time +");")
                }
                resDb.run('COMMIT',()=>{
                    resDb.close()
                    res()
                })
            })
        })
    });
    
});

//添加随机时间、关键词
const addToDb = (db, arg) => new Promise((res, rej) => {
    db.run("CREATE TABLE IF NOT EXISTS temp_Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT,'title2' TEXT,'pub_time' INTEGER DEFAULT 0);", () => {
        db.all("SELECT title,content FROM Content ", (err, rows) => {
            let pub_time = 0
            let title2 = null
                //读取随机关键词文件，保存为数组keywordArr
            if (arg.keywordFileArr.length) {
                var keywordArr = new Array
                for (let value of arg.keywordFileArr) {
                    keywordArr.push(fs.readFileSync(value, 'utf-8').split(/\r+\n+/g))
                }
            }
            if (arg.randTime) {
                var currentTime = Date.parse(new Date()) / 1000
            }
            //遍历数据库
            db.serialize(() => {
                db.run('BEGIN;');
                for (let i = 0; i < rows.length; i++) {
                    //获取随机关键词
                    if (arg.keywordFileArr.length) {
                        title2 = ""
                        for (let value of keywordArr) {
                            title2 += value[Math.floor(Math.random() * value.length)] + " "
                        }
                        title2 = "'" + title2.trim() + "'"
                    }
                    //获取随机时间
                    if (arg.randTime) {
                        if (i < arg.randTime.publishCount) {
                            pub_time = currentTime - Math.floor(Math.random() * arg.randTime.publishDay * 3600 * 24)
                        } else {
                            pub_time = currentTime + Math.floor(Math.random() * arg.randTime.futureDay * 3600 * 24)
                        }
                    }
                    sql = "INSERT INTO temp_Content (title,content,pub_time,title2) VALUES('" + rows[i].title + "','" + rows[i].content + "'," + pub_time + "," + title2 + ")"
                    db.run(sql)
                }
                db.run('COMMIT', function() {
                    //删除原Content，temp_Content中的内容保存入新的Content
                    db.serialize(() => {
                        db.run("BEGIN;")
                        db.run("DROP TABLE Content;")
                        db.run("CREATE TABLE IF NOT EXISTS Content ('ID'  INTEGER PRIMARY KEY AUTOINCREMENT,'title'  TEXT,'content' TEXT,'title2' TEXT,'pub_time' INTEGER DEFAULT 0,'is_ping' DEFAULT 0);")
                        db.run("INSERT INTO Content (`title`,`content`,`pub_time`,`title2`) SELECT `title`,`content`,`pub_time`,`title2` FROM 'temp_Content' ORDER BY pub_time;");
                        db.run("DROP TABLE temp_Content;")
                        db.run("COMMIT;", res)
                    })
                });
            })
        })
    });
});

//清理无用数据
const vacuumDb = (db) => new Promise((res, rej) => {
    db.serialize(() => {
        db.run("DROP TABLE IF EXISTS temp_Content;")
        db.run("VACUUM;", res)
    })
});