/**
 * Controllers->RuleBundle->CRUD-> helper.js
 *
 */

var _ = require('lodash'),
  Q = require('q'),
  winston = require('winston');

var utils = require('mule-utils/jsonUtils'),
  RuleBundle = require('mule-models').RuleBundle.Model;

exports.indexQ = function () {
  return RuleBundle.find().execQ();
};

exports.createQ = function (params) {

  return Q.promise( function (resolve, reject) {
    winston.info("User attempting to create new RuleBundle: params: ", params );

    var newRoleBundle = new RuleBundle(params);
    newRoleBundle.saveQ()
      .done(resolve, reject);

  });
};

exports.readQ = function (ruleBundleId){
  return RuleBundle.findByIdQ(ruleBundleId);
};

exports.update = function (parameters, callback) {

};

exports.destroy = function (parameters, callback) {

};
