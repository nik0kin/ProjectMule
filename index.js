/***************************************
 *  require('mule').initQ(config)      *
 *                                     *
 *    the bootstrapper for mule        *
 * - init logging                      *
 * - Start DB                          *
 * - Config express/passport & start express
 * - init RuleBundles                  *
 *    - save RuleBundles to db         *
 *    - turnsystem/autocreate game checks
 **************************************/

var mkdirp = require('mkdirp'),
    fs = require('fs'),
    Q = require('q'),
    _ = require('lodash');

var express = require('express'),
    passport = require('passport');

var MuleUtils = require('mule-utils'),
    dateUtils = require('mule-utils/dateUtils'),
    Logger = MuleUtils.logging,
    MuleRules = require('mule-rules'),
    MuleModels = require('mule-models');

var app;

var startLoggingQ = function (config) {
  return Q.promise(function (resolve, reject) {
    mkdirp(config.logsPath, function (err) {
      if (err) console.error(err);

      Logger.init(4, config.logsPath + '/mule' + dateUtils.getNiceDate() + '.log');
      MuleModels.initLogger(Logger);
      resolve();
    });
  });
};

var startExpress = function (expressConfig, dbUrl) {
  // bootstrap passport config
  require('./config/passport')(passport);

  app = express();
  // express settings
  require('./config/express')(app, expressConfig, dbUrl, passport);

  // Bootstrap routes
  var router = express.Router();
  require('./app/routes')(router, passport);
  app.use(expressConfig.routesPrefix, router);

  //Start the app by listening on <port>
  app.listen(expressConfig.port);
};

var startMuleSystems = function (muleConfig) {
  var turnTimerSystem = require('./app/turnSystem/turnTimer'),
      autoCreateGameSystem = require('./app/autoCreateGame');

  // Load RuleBundles
  var ruleBundleHelper = require('./app/routes/ruleBundles/crud/helper'); // BUT DUMB
  require('mule-rules/lib/initRuleBundles').loadOnce(ruleBundleHelper, _.keys(muleConfig.ruleBundles), function () {
    // this calls back whether rulebundles are created or not
    autoCreateGameSystem.initAutoGameChecks(muleConfig);
  });
  turnTimerSystem.initTurnTimerChecks(muleConfig.minimumGameRoundTimerCheck);
};

exports.init = function (config, callback) {
  initQ(config)
    .then(function () {
      callback();
    });
};

exports.initQ = function (config) {
  if (app) {
    // probably the testsuite, dont re init
    return Q();
  };

  return startLoggingQ(config)
    .then(function () {
      Logger.log('Logger Online');
      return MuleModels.initDatabaseQ(config.database);
    })
    .then(function () {
      Logger.log('DB Online');

      startExpress(config.http, config.database.db);
      Logger.log('HTTP Online');
    })
    .then(function () {
      startMuleSystems(config.mule);
      Logger.log('Mule Systems Online');

      Logger.log('The Mule has started his journey ('+config.http.port+')');
    })
    .fail(function (error) {
      Logger.error('The Mule has stumbled on the path', null, error);
      throw error;
    });
};
