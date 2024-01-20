const mineflayer = require('mineflayer');
const fs = require('fs');
let config = JSON.parse(fs.readFileSync(`${process.cwd()}/config.json`, 'utf8'))
let bot;
let continue_list = Object.keys(config.warps);
let run = true
let botargs = {
    username: config.username,
    host: config.host,
    port: config.port,
    version: config.version,
    auth: config.auth,
}

async function sign(warp) {
    try {
        bot.chat(`/warp ${warp}`);
        console.log(`-------------------------------`)
        console.log(`資訊: 正在前往下個傳點簽到\n傳點名稱: ${warp}\n機器人名稱: ${config.warps[warp]}`);

        await new Promise(resolve => setTimeout(resolve, 5000));

        if (warp == 'PChome24') {
            bot.chat(`/m ${config.warps[warp]} 貨到付款`);
        } else {
            bot.chat(`/m ${config.warps[warp]} 簽到`);
        }

        const sign_in_success_pattern = /^(\[系統\] 您收到了 .*\(目前擁有 .*\))$/;
        const ddddo_already_signed_pattern = /\[(.*?) -> 您\] 今日已重複簽到(\d{4}\/\d{2}\/\d{2})/;
        const konjac_already_signed_pattern = /\[(.*?) -> 您\] 您已領取您的身分組獎勵，請明天再來領取 已領身分組獎勵: \[(.*?)\]/;
        const konjac_wait_pattern = /\[(.*?) -> 您\] 執行這項操作還需要等待 (.*?)/;
        const other_already_signed_pattern = /\[(.*?) -> 您\] (.*)/;
        const bot_not_online_pattern = /\[系統\] 無法取得 (.*?) 的玩家資料，您打錯ID了嗎\?/;
        const konjac_success_pattern = /\[(.*?) -> 您\] \[\d{2}:\d{2}:\d{2}\]: (.*?)/;
        const system_pattern = /^\[系統\]/;

        try {
            const msg = await Promise.race([
                bot.awaitMessage(sign_in_success_pattern),
                bot.awaitMessage(ddddo_already_signed_pattern),
                bot.awaitMessage(konjac_already_signed_pattern),
                bot.awaitMessage(konjac_wait_pattern),
                bot.awaitMessage(other_already_signed_pattern),
                bot.awaitMessage(bot_not_online_pattern),
                bot.awaitMessage(system_pattern),
                new Promise((resolve) => setTimeout(() => resolve('Timeout'), 20000))
            ]);

            if (sign_in_success_pattern.test(msg)) {
                var combinedAmountMatch = msg.match(/您收到了.*?(\d{1,3}(,\d{3})*?) 綠寶石.*?目前擁有 (\d{1,3}(,\d{3})*?) 綠寶石/);
                var receivedAmount = combinedAmountMatch ? parseInt(combinedAmountMatch[1].replace(/,/g, '')) : 0;
                var currentAmount = combinedAmountMatch ? parseInt(combinedAmountMatch[3].replace(/,/g, '')) : 0;
                console.log(`成功: 已成功簽到！\n領取數量: ${receivedAmount} 個\n目前數量: ${currentAmount} 個`)
                const konjac_success_msg = await Promise.race([bot.awaitMessage(konjac_success_pattern), new Promise((resolve) => setTimeout(() => resolve('Timeout'), 20000))])

                if (konjac_success_msg != 'Timeout') {
                    const regex = /https:\/\/dice\.patyhank\.net\S*/g;
                    const matches = konjac_success_msg.match(regex);
                    if (matches != null) {
                        console.log(`資訊: 請完成防人機驗證\n說明: 請完成防人機驗證以繼續至下一個傳點簽到，十秒鐘後繼續下個傳點\n連結: ${matches[0]}`);
                    }
                }
                continue_list.shift();
                await new Promise(resolve => setTimeout(resolve, 10000));
            } else if (ddddo_already_signed_pattern.test(msg)) {
                console.log(`錯誤: 今日您已經簽到過了\nBot ID: ${config.warps[warp]}\n最後簽到時間: ${ddddo_already_signed_pattern.exec(msg)[2]}`);
                continue_list.shift();
            } else if (konjac_already_signed_pattern.test(msg)) {
                console.log(`錯誤: 今日您已經簽到過了\nBot ID: ${config.warps[warp]}\n您的身份組: ${konjac_already_signed_pattern.exec(msg)[2]}`);
                continue_list.shift();
            } else if (konjac_wait_pattern.test(msg)) {
                const regex = /https:\/\/dice\.patyhank\.net\S*/g;
                const matches = msg.match(regex);
                console.log(`錯誤: 防人機驗證未完成\n說明: 請先完成防人機驗證以重新簽到，此傳點將會在所有簽到處理完後重新嘗試簽到\n連結: ${matches[0]}`);
                await new Promise(resolve => setTimeout(resolve, 15000));
            } else if (bot_not_online_pattern.test(msg)) {
                console.log(`錯誤: 機器人不在線上\nBot ID: ${config.warps[warp]}`);
                continue_list.shift()
            } else if (system_pattern.test(msg)) {
                console.log(`錯誤: 系統訊息\n訊息: ${msg}\n此傳點將會在所有簽到處理完後重新嘗試簽到`);
            } else if (msg === '機器人沒回應或發生了意外的錯誤') {
                console.log('錯誤: 機器人沒回應或發生意外的錯誤\n說明: 此傳點將會在所有簽到處理完後重新嘗試簽到')
            } else {
                console.log(`錯誤: 今日您已經簽到過了\nBot ID: ${config.warps[warp]}\n訊息: ${other_already_signed_pattern.exec(msg)[2]}`)
                continue_list.shift();
            }

            await new Promise(resolve => setTimeout(resolve, 5000));

        } catch (err) {
            console.log('錯誤: 發生不可預期的錯誤\n', err);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    } catch (err) {
        console.log('錯誤: 發生不可預期的錯誤\n', err);
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    for (listener of bot.listeners('messagestr')) {
        bot.removeListener('messagestr', listener);
    }
}

async function auto_sign() {
    if (continue_list.length == 0) {continue_list = Object.keys(config.warps)}
    for (const warp of continue_list) {
        if (run == false) {return}
        await sign(warp);
    }
    while (continue_list.length > 0) {
        for (item of continue_list) {
            if (run == false) {return}
            await sign(item);
            continue_list.shift();
        }
    }
    console.log('資訊 : 已完成所有簽到');
}

async function connect() {
    console.log('資訊: 機器人已啟動，正在登入伺服器...')
    bot = mineflayer.createBot(botargs);
    bot.once('spawn', async () => {
        console.log('資訊: 已載入世界，五秒後開始簽到');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await auto_sign();
        run = true
    });

    bot.once('login', async () => {
        console.log('資訊: 已登入伺服器');
    });

    bot.on('error', (err) =>{
        console.log('錯誤: 發生不可預期的錯誤\n', err)
        run = false
    });
    bot.on('end', async () => {
        console.log('資訊: 已斷線，將於五秒鐘後重新連線，之前的進度不會受影響');
        await new Promise(resolve => setTimeout(resolve, 5000));
        connect();
    });
}

connect();