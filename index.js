// /////////////////////////////////////////////////////////////////// //
//                                                                     //
// SocialNotifier App          // Author: Artur Nowocien               //
// Version V0.1                // Platform: SIMATIC Industrial Edge    //
//                                                                     //
// /////////////////////////////////////////////////////////////////// //
                                                 

const Telegraf = require('telegraf')
const { OPCUAClient, AttributeIds, TimestampsToReturn, DataType } = require("node-opcua")
const fs = require("fs")
const async = require("async")
const USER_ID = process.env.USER_ID       // ID uzytkownika czytane przez bota 'userinfobot'
const BOT_TOKEN = process.env.BOT_TOKEN   // Token generowany przez BotFather
const bot = new Telegraf(process.env.BOT_TOKEN)
const conf = updateSettings()
const endpointUrl = `opc.tcp://${conf.opcServerIp}:${conf.opcServerPort}`
const client = OPCUAClient.create({ endpointMustExist: false })

var userIdentity = {
  userName: conf.opcUser,
  password: conf.opcPass
}
var theSession = null
var alarms = [], previousAlarms = [], ack = []

console.log('SocialNotifier started')
bot.startPolling()
establishConnection()
talkToBot()


// ESTABLISHING COMMUNICATION WITH OPC UA SERVER
async function establishConnection () {
  async.series([
    function(callback) {
      // 1 - Connect to the server
      client.connect(endpointUrl, function(err) {
          if (err) {
              console.error("Cannot connect to endpoint :", endpointUrl)
          } else {
              console.info(`Connected with ${endpointUrl}`)
          }
          callback(err)
      })
    },
    
    // 2 - Create new session
    function(callback) {
        client.createSession(userIdentity, function(err, session) {
            if (!err) {
                theSession = session
                subscribeValues()
            }
            callback(err)
        })
    }
  ])
}
// SUBSCRIPTION PART
async function subscribeValues () {
  async function main() {
    try {
      async.series([
        // 1 - Create subscription
        function(callback) {
          theSession.createSubscription2({
              requestedPublishingInterval: 1000,
              requestedLifetimeCount: 1000,
              requestedMaxKeepAliveCount: 20,
              maxNotificationsPerPublish: 10,
              publishingEnabled: true,
              priority: 10
          }, function(err, subscription) {
              if (err) { return callback(err) }
              theSubscription = subscription
              theSubscription
                .on("keepalive", () => {})
                .on("terminated", () => { console.warning('Session has been terminated!' )})
              callback()
          })
        },
        // 2 - Install monitored item (array of alarms)
        function(callback) {
          theSubscription.monitor({
              nodeId: conf.alarmNodeId,
              attributeId: AttributeIds.Value
          },
          {
              samplingInterval: conf.samplingInterval,
              discardOldest: true,
              queueSize: 10
          }, TimestampsToReturn.Both,
          (err, monitoredItem) => {
              monitoredItem
                  .on("changed", value => {
                      alarms = []
                      value.value.value.forEach((item, index) => {
                        alarms.push({
                          type: item.type,
                          pending: item.pendingAlarm,
                          ackRequired: item.ackRequired,
                          alarmText: item.alarmText
                        })
                        if (previousAlarms[index] !== undefined) {
                          if (previousAlarms[index].pending !== alarms[index].pending) {
                            pushNotification(alarms[index], index)
                          }
                        }
                        if (previousAlarms[index] !== undefined) {
                          previousAlarms[index] = alarms[index]
                          ack[index] = false
                        } else {
                          previousAlarms.push(alarms[index])
                        }
                      })
                  })
                  .on("err", err => {
                      console.error(`Error when monitoring item: ${err.message}`)
                  })
              callback(err)
          })
        }
      ])
    }
    catch (err) {
        console.error("Error: ", err)
    }
  }
  main()
}
// NOTIFICATION PART
function pushNotification (alarm, id) {

  // Definition of notification elements
  //
  let icon, type, NOTIFICATION
  if (alarm.type == 0) {
    icon = String.fromCodePoint(0x274C)
    type = `ALARM ${id+1}\n\n`
  } else if (alarm.type == 1) {
    icon = String.fromCodePoint(0x26A0)
    type = `OSTRZEŻENIE ${id+1}\n\n`
  } else if (alarm.type == 2) {
    icon = String.fromCodePoint(0x2611)
    type = `INFORMACJA ${id+1}\n\n`
  }

  // Definition of acknowledge buttons
  //
  const ackButton = Telegraf.Extra
    .markdown()
    .markup((m) => m.inlineKeyboard([
      m.callbackButton(`${String.fromCodePoint(0x2705)}  Potwierdź`, `ack ${id}`),
      m.callbackButton(`${String.fromCodePoint(0x2705)}  Potwierdź wszystkie alarmy`, `ackAll`)
  ]))

  // Sending notification to user
  //
  if (alarm.pending) {
    try {
      if (alarm.ackRequired) {
        NOTIFICATION = `${icon}   PENDING ${type}${alarm.alarmText}`
        bot.telegram.sendMessage(USER_ID, NOTIFICATION)
      } else {
        NOTIFICATION = `${icon}   ${type}${alarm.alarmText}`
        bot.telegram.sendMessage(USER_ID, NOTIFICATION)
      }
    } catch (err) { console.error(err) }
  } else {
    try {
      if (alarm.ackRequired) {
        NOTIFICATION = `${icon}   OUTGOING ${type}${alarm.alarmText}`
        bot.telegram.sendMessage(USER_ID, NOTIFICATION, ackButton)
      }
    } catch (err) { console.error(err) }
  }
  
  // Handling user feedback for alert acknowledgement
  //
  // Single alert
  bot.action(/ack (.+)/, (ctx, next) => {
    try {
      let id = parseInt(ctx.match[1])
      ack[id] = true
      try {
        theSession.writeSingleNode(conf.ackNodeId + `[${id}]`, {
          dataType: DataType.Boolean,
          value: true
        })
        bot.telegram.sendMessage(USER_ID, `Alarm  ${id+1} potwierdzony`)
        ack[id] = false
      } catch (err) { console.error(err)}
    } catch (err) {console.log(err)}
  })
  // All alerts
  bot.action('ackAll', (ctx) => {
    try {
      ack.forEach((item, index) => {
        ack[index] = true
        try {
          theSession.writeSingleNode(conf.ackNodeId + `[${index}]`, {
            dataType: DataType.Boolean,
            value: true
          })
          ack[index] = false
        } catch (err) { console.error(err)}
      })
      bot.telegram.sendMessage(USER_ID, `Wszystkie alarmy zostały potwierdzone`)
    } catch (err) {console.log(err)}
  })
  
}
// EXTRA CONVERSATION WITH BOT (BETA)
function talkToBot () {

  bot.start((ctx) => ctx.reply( `Witaj w aplikacji SocialNotifier.\n\n
Jest ona dedykowana do obsługi prostych powiadomień wysyłanych ze sterownika PLC.
Dostosuj program sterownika korzystając ze zmiennych UDT i bloków dostarczonych z przykładowym projektem.\n\n
Dostępne komendy:\n
/start - wiadomość powitalna
/version - informacja o wersji\n`
  ))

  bot.hears('/version', (ctx) => {
    ctx.reply('V0.1')
  })
}
// READ CONFIG FILE AND STORE IN MEMORY
function updateSettings() {
  try {
    let result = fs.readFileSync('cfg-data/conf.json', 'utf8')
    return JSON.parse(result)
  } catch (err) { console.error(err) }
}