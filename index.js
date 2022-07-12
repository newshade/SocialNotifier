// TELEGRAM NOTIFIER

const Telegraf = require('telegraf')
const {
  OPCUAClient, makeBrowsePath, 
  AttributeIds, resolveNodeId, 
  TimestampsToReturn, DataType,
  installAlarmMonitoring, DataTypeDefinition,
  ClientAlarmList, EventEmitter
} = require("node-opcua")
const async = require("async");
const USER_ID = process.env.USER_ID       // ID uzytkownika czytane przez bota 'userinfobot'
const BOT_TOKEN = process.env.BOT_TOKEN   // Token generowany przez BotFather
const bot = new Telegraf(process.env.BOT_TOKEN)
var acknowledge = false
var userIdentity = {
  userName: 'administrator',
  password: 'Sim@tic1518'
};

// Wiadomosc powitalna
bot.start((ctx) => ctx.reply(

  `Witaj w testowym bocie Social Notifier.\n\n
  Możesz skorzystać z jednej z poniższych komend:\n
  /start - wiadomośc powitalna\n
  /test - testowy alarm z potwierdzeniem`

  ))


bot.hears('alarm', (ctx) => {
  // Nasłuchiwanie wiadomości
  ctx.reply('Wyzwolona funkcja ESTOP_8, wymagane potwierdzenie')
})
//bot.startPolling()



console.log('Telegram bot started.')
//var counter = 1;
//setInterval(function () { 
//    bot.telegram.sendMessage(USER_ID, 'Wiadomosc numer: ' + counter).catch(err => console.log(err))
//    console.log(counter + '. wiadomosc wyslana');
//    counter++
//}, 5000); 

var ALARM_TEXT = `${String.fromCodePoint(0x26A0)} OSTRZEŻENIE\n\nPrzekroczono dopuszczalną temperaturę grzania!`

const alarmButton = Telegraf.Extra
  .markdown()
  .markup((m) => m.inlineKeyboard([
    m.callbackButton(`${String.fromCodePoint(0x2705)}  Potwierdź`, 'ack')
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
subscribeAlarms()


// Communication part
async function subscribeAlarms () {

  const endpointUrl = "opc.tcp://192.168.137.10:4840";
  const nodeId = "ns=7;s=Scalar_Simulation_Double";
  let theSession = null;
  const userIdentity = {
    userName: 'administrator',
    password: 'Sim@tic1518'
  };
  const client = OPCUAClient.create({ endpointMustExist: false });
  const alarmList = new ClientAlarmList;

  async function main() {

      try {
        async.series([
          // step 1 : connect to
          function(callback) {

            client.connect(endpointUrl, function(err) {

                if (err) {
                    console.log(" cannot connect to endpoint :", endpointUrl);
                } else {
                    console.log("connected !");
                }
                callback(err);
            });
        },
        // step 2 : createSession
        function(callback) {
            client.createSession(userIdentity, function(err, session) {
                if (!err) {
                    theSession = session;
                }
                callback(err);
            });

        },
        // create subscription
        function(callback) {

          theSession.createSubscription2({
              requestedPublishingInterval: 1000,
              requestedLifetimeCount: 1000,
              requestedMaxKeepAliveCount: 20,
              maxNotificationsPerPublish: 10,
              publishingEnabled: true,
              priority: 10
          }, function(err, subscription) {
              if (err) { return callback(err); }
              theSubscription = subscription;

              theSubscription.on("keepalive", function() {
                  console.log("keepalive");
              }).on("terminated", function() {
              });
              callback();
          });

        },
        function(callback) {
          // install monitored item
          //
          theSubscription.monitor({
              nodeId: resolveNodeId("Server"),
              attributeId: AttributeIds.EventNotifier
          },
              {
                  samplingInterval: 100,
                  discardOldest: true,
                  queueSize: 10
              }, TimestampsToReturn.Both,
              (err, monitoredItem) => {
                  console.log("-------------------------------------");
                  monitoredItem
                      .on("changed", function(value) {
                          console.log(" New Value = ", value.toString());
                      })
                      .on("err", (err) => {
                          console.log("MonitoredItem err =", err.message);
                      });
                  callback(err);
  
              });
        },
        function(callback) {
            // install monitored item
            //
            installAlarmMonitoring(theSession, (err, alarms) => {
              if (!err) {
                console.log(alarms)
              }
            })
            
            callback();
        },
        function(callback) {
          console.log("sequence done");
        }
      ])
    }
    catch (err) {
        console.log("Error !!!", err);
        //process.exit();
    }
  }

  main();

}