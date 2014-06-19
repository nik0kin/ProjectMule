var _ = require('lodash'),
  Q = require('q'),
  winston = require('winston');

var utils = require('mule-utils/jsonUtils'),
  Game = require('mule-models').Game.Model,
  RuleBundleUtils = require('mule-models/models/RuleBundle/util'),
  integerUtils = require('mule-utils/integerUtils'),
  gameBoardHelper = require('../../gameBoards/crud/helper');

module.exports = function (params) {    //TODO this is starting to look ugly
  var validatedParams = params.validatedParams;
  var creator = params.creator;//expecting a user

  return Q.promise( function (resolve, reject) {
    winston.info("User attempting to create new game: params: ", validatedParams );

    validatedParams.gameStatus = 'open';

    var newGame = new Game(validatedParams);

    RuleBundleUtils.findRuleBundleByIdOrNameQ(validatedParams.ruleBundle)
      .done(function (foundRuleBundle) {
        // valid rulebundle
        newGame.ruleBundle = {
          id : foundRuleBundle._id,
          name : foundRuleBundle.name
        };
        newGame.markModified('ruleBundle');

        if (!foundRuleBundle.canAutoProgress) {
          // dont allow autoprogress
          if (newGame.turnProgressStyle == 'autoprogress') {
            reject({err: '\'autoprogress\' not allowed on this RuleBundle(' + foundRuleBundle.name + ')'})
          }
        }

        parseMaxPlayersQ(foundRuleBundle, newGame)
          .then(function (newGameR) {
            parseCustomBoardSettingsQ(foundRuleBundle, newGameR)
              .then(function (newGameRR) {
                gameBoardHelper.createQ({ruleBundle: newGame.ruleBundle, rules: foundRuleBundle.rules, customBoardSettings: newGame.ruleBundleGameSettings.customBoardSettings})
                  .done(function (gameBoard) {
                    winston.info('gameBoard Saved', gameBoard);
                    newGameRR.gameBoard = gameBoard._id;

                    newGameRR.validate( function (err) {
                      if (err) {
                        winston.log('error', 'ValidationError for gameConfigs to Game document');
                        return reject(err);
                      }

                      if (!creator) {
                        winston.info('doing unit tests');
                        newGameRR.saveQ()
                          .done(resolve, reject);
                      } else {
                        winston.info('creating game with creator: ', creator._doc);
                        newGameRR.joinGameQ(creator)
                          .done(function () {
                            newGameRR.saveQ()
                              .done(resolve, reject);
                          }, reject);
                      }
                    });
                  })
                  .fail(reject);
                  }, reject);
          })
          .fail(reject);
      }, function (err) {
        winston.error(err);
        reject('invalid ruleBundle id or name')
      });
  });
};

var parseMaxPlayersQ = function (foundRuleBundle, newGame) {
  return Q.promise( function (resolve, reject) {
    if (integerUtils.isInt(foundRuleBundle.gameSettings.playerLimit)) {
      newGame.maxPlayers = foundRuleBundle.gameSettings.playerLimit;
    } else if (integerUtils.isMinMaxIntegerObject(foundRuleBundle.gameSettings.playerLimit)) {
      if (integerUtils.isIntegerMinMaxValid(newGame.maxPlayers, foundRuleBundle.gameSettings.playerLimit)) {
        //valid maxPlayers
      } else
        return reject('playerMax not within RoleBundle min-max playerLimit')
    } else if (_.isArray(foundRuleBundle.gameSettings.playerLimit)) {
      if(!_.contains(foundRuleBundle.gameSettings.playerLimit, newGame.maxPlayers))
        return reject('playerMax not in RoleBundle playerLimit array');
    } //else rulebundle maxPLayers not set

    resolve(newGame);
  });
};

var parseCustomBoardSettingsQ = function (foundRuleBundle, newGame) {
  return Q.promise( function (resolve, reject) {
    var invalidSettings = {};

    var validatedCustomBoardSettings = {};

    if (foundRuleBundle.gameSettings && foundRuleBundle.gameSettings.customBoardSettings) {
      _.each(foundRuleBundle.gameSettings.customBoardSettings, function (value, key) {
        var paramToValidate = parseInt(newGame.ruleBundleGameSettings.customBoardSettings[key]); // needs better names

        winston.log('verbose', key + ' ' + JSON.stringify(value) + ' ? ' + paramToValidate);
        if (integerUtils.validateIntegerInArrayOrMinMax(value, paramToValidate)) {
          validatedCustomBoardSettings[key] = paramToValidate;
        } else {
          invalidSettings[key] = {text: 'invalid param (' + JSON.stringify(value) + ')'};
        }
      });
    } else {
      newGame.ruleBundleGameSettings = {};
    }

    newGame.ruleBundleGameSettings.customBoardSettings = validatedCustomBoardSettings;
    if (_.isEmpty(invalidSettings))
      resolve(newGame);
    else
      reject(invalidSettings);
  });
};
