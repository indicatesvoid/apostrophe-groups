var async = require('async');
var _ = require('underscore');
var extend = require('extend');
var snippets = require('apostrophe-snippets');
var util = require('util');

// Creating an instance of the groups module is easy:
// var groups = require('apostrophe-groups')(options, callback);
//
// If you want to access the constructor function for use in the
// constructor of a module that extends this one, consider:
//
// var groups = require('apostrophe-groups');
// ... Inside the constructor for the new object ...
// groups.Groups.call(this, options, null);
//
// In fact, this module does exactly that to extend the snippets module
// (see below). Something similar happens on the browser side in
// main.js.

module.exports = groups;

function groups(options, callback) {
  return new groups.Groups(options, callback);
}

groups.Groups = function(optionsArg, callback) {
  var self = this;

  self._people = optionsArg.people;

  var options = {
    instance: 'group',
    name: 'groups',
    label: 'Groups',
    icon: 'groups',
    menuName: 'aposGroupsMenu',
    browser: {
      // Options to be passed to the browser side constructor
      // Allows us to talk to the autocomplete action for people
      options: {
        peopleAction: self._people._action
      }
    }
  };
  extend(true, options, optionsArg);

  if (!options.browserOptions) {
    options.browserOptions = {};
  }
  options.browserOptions.peopleAction = self._people.action;

  options.modules = (options.modules || []).concat([ { dir: __dirname, name: 'groups' } ]);

  // TODO this is kinda ridiculous. We need to have a way to call a function that
  // adds some routes before the static route is added. Maybe the static route should
  // be moved so it can't conflict with anything.
  if (!options.addRoutes) {
    options.addRoutes = addRoutes;
  } else {
    var superAddRoutes = options.addRoutes;
    options.addRoutes = function() {
      addRoutes();
      superAddRoutes();
    };
  }

  function addRoutes() {
  }

  // Call the base class constructor. Don't pass the callback, we want to invoke it
  // ourselves after constructing more stuff
  snippets.Snippets.call(this, options, null);

  self.afterSave = function(req, data, snippet, callback) {
    // The person-group relationship is actually stored in the
    // person objects. Blast them with $addToSet and $in, and
    // conversely, $pull and $nin.
    var personIds = _.map(data._personIds, function(personId) {
      return self._apos.sanitizeString(personId);
    });
    async.series([add, remove], callback);

    function add(callback) {
      return self._apos.pages.update({ _id: { $in: personIds } }, { $addToSet: { groupIds: snippet._id } }, { multi: true }, callback);
    }

    function remove(callback) {
      return self._apos.pages.update({ _id: { $nin: personIds } }, { $pull: { groupIds: snippet._id } }, { multi: true }, callback);
    }
  };

  // Join groups with their people, but only when returning just one
  var superGet = self.get;
  self.get = function(req, optionsArg, callback) {
    var options = {};
    // "Why copy the object like this?" If we don't, we're modifying the
    // object that was passed to us, which could lead to side effects
    extend(true, options, optionsArg || {});
    var getPeople = true;
    if (options.getPeople === false) {
      getPeople = false;
    }
    delete options.getPeople;

    // Add the associated people to the returned objects (manual join). Use a
    // leading underscore to denote that this property is temporary and should
    // not be saved. Do this only if there is just one group being returned, for now
    // (TODO: write a version of apos.joinOneToMany that works when the relationship
    // is stores on the "one" side and use that to support broadening this).
    return superGet.call(self, req, options, function(err, results) {
      if (err) {
        return callback(err);
      }
      var snippets = results.snippets;
      async.series([join], function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, results);
      });
      function join(callback) {
        if (!getPeople) {
          return callback(null);
        }
        return self._apos.joinOneToManyReverse(req, snippets, 'groupIds', '_people', { get: self._people.get, getOptions: { getGroups: false } }, function(err) {
          if (err) {
            return callback(err);
          }
          return callback(null, results);
        });
      }
    });
  };

  if (callback) {
    // Invoke callback on next tick so that the groups object
    // is returned first and can be assigned to a variable for
    // use in whatever our callback is invoking
    process.nextTick(function() { return callback(null); });
  }
};

