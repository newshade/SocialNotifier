// TELEGRAM NOTIFIER

const Telegraf = require('telegraf')
//const BOT_TOKEN = '1133596886:AAHrPa1cXXQAzZRPkSWvbJVJeM0yd9_x7HI'                        //Token generowany przy tworzeniu BOTa
var USER_ID = 5330515522;                                                                   //ID uzytkownika czytane przez bota 'userinfobot'
const bot = new Telegraf(process.env.BOT_TOKEN)
var acknowledge = false

// Wiadomosc powitalna
bot.start((ctx) => ctx.reply('Witaj w testowym bocie Social Notifier.\n\nMożesz skorzystać z jednej z poniższych komend:\n/start - wiadomośc powitalna\ntest - testowy alarm z potwierdzeniem'))
bot.hears('alarm', (ctx) => ctx.reply('Wyzwolona funkcja ESTOP_8, wymagane potwierdzenie'))
//bot.startPolling()



console.log('Telegram bot started.')
//var counter = 1;
//setInterval(function () { 
//    bot.telegram.sendMessage(USER_ID, 'Wiadomosc numer: ' + counter).catch(err => console.log(err))
//    console.log(counter + '. wiadomosc wyslana');
//    counter++
//}, 5000); 

var ALARM_TEXT = 'Fatal error - machine is about to shut down.'

const alarmButton = Telegraf.Extra
  .markdown()
  .markup((m) => m.inlineKeyboard([
    m.callbackButton(`${String.fromCodePoint(0x2705)} Potwierdź`, 'ack')
  ]))

bot.hears('/test', (ctx) => 
  bot.telegram.sendMessage(USER_ID, ALARM_TEXT, alarmButton).catch(err => console.log(err)))

bot.action('ack', (ctx) => {
  try{
    bot.telegram.sendMessage(USER_ID, 'Alarm potwierdzony')
    acknowledge = true
    console.log(acknowledge)
  } catch (err) {console.log(err)}
})
bot.startPolling()