var async = require('async');
var _ = require('lodash');
var extend = require('extend');
var snippets = require('apostrophe-snippets');
var util = require('util');

module.exports = groups;

function groups(options, callback) {
  return new groups.Groups(options, callback);
}

groups.Groups = function(options, callback) {
  var self = this;

  var schemas = options.schemas;

  // Only admins can edit this data type
  self._adminOnly = true;

  _.defaults(options, {
    instance: 'group',
    name: 'groups',
    label: 'Directory',
    pluralLabel: 'Groups',
    instanceLabel: 'Group',
    icon: 'icon-directory',
    menuName: 'aposGroupsMenu',
    peopleType: 'people',
    browser: {}
  });

  if (options.peopleSortable) {
    options.browser.peopleSortable = true;
  }

  // Fix to allow sortable to work properly when
  // other "extras" are shut off
  if (options.peopleExtras === false) {
    options.peopleExtras = [];
  }

  options.addFields = [
    {
      type: 'a2Permissions',
      label: 'Permissions',
      name: 'permissions'
    },
    {
      type: 'a2People',
      label: 'People',
      name: 'people',
      extras: (options.peopleExtras !== undefined) ? options.peopleExtras : [
        {
          name: 'jobTitle',
          label: 'Job Title',
          type: 'text'
        }
      ]
    }
  ].concat(options.addFields || []);

  if (!options.indexSchema) {
    options.indexSchema = {};
  }

  options.indexSchema.removeFields = [
    'withTags', 'notTags'
  ].concat(options.indexSchema.removeFields || []);

  options.indexSchema.addFields = [
    {
      name: '_groups',
      label: 'Members Of These Groups Only',
      type: 'joinByArray',
      withType: options.instance,
      idsField: 'groupIds'
    },
    {
      name: '_notGroups',
      label: 'Never Members Of These Groups',
      type: 'joinByArray',
      withType: options.instance,
      idsField: 'notGroupIds'
    },
    {
      name: 'defaultView',
      label: 'Default View',
      type: 'select',
      def: 'groups',
      choices: [
        { value: 'groups', label: "Show Groups" },
        { value: 'people', label: "Show People" }
      ]
    },
    {
      name: 'showThumbnail',
      label: 'Headshots In List View',
      type: 'boolean',
      def: false
    }
  ].concat(options.indexSchema.addFields || []);

  // If somebody REALLY doesn't want to group their fields,
  // take the hint, otherwise supply a default behavior
  if (options.groupFields !== false) {
    options.groupFields = options.groupFields ||
      // We don't list the title field so it stays on top
      [
        {
          name: 'groupPermissions',
          label: 'Permissions',
          fields: [
            'permissions'
          ]
        },
        {
          name: 'groupPeople',
          label: 'People',
          icon: 'user',
          fields: [
            'people'
          ]
        },
        {
          name: 'groupDescription',
          label: 'Description',
          fields: [
            'thumbnail', 'body'
          ]
        },
        {
          name: 'groupAdmin',
          label: 'Admin',
          icon: 'metadata',
          fields: [
            'published', 'tags'
          ]
        }
      ];
  }

  // Specialized schema field type just for the permissions
  // selectors. The field name is ignored and it works
  // exactly as it did before we had it as a field type. We
  // refactored this way so that grouping the people control
  // into a tab would be possible.


  schemas.addFieldType({
    name: 'a2Permissions',
    render: function(data) {
      data.permissions = self._permissions;
      return self.render('permissionsField', data);
    },
    converters: {
      form: function(req, data, name, snippet, field, callback) {
        snippet.permissions = [];
        _.each(self._permissions, function(permission) {
          if (self._apos.sanitizeBoolean(data[permission.value])) {
            snippet.permissions.push(permission.value);
          }
        });
        return callback(null);
      },
      csv: function(req, data, name, snippet, field, callback) {
        snippet[field.name] = [];
        var received = data[name].split(/,\s*/);
        snippet[field.name] = _.intersection(received, self._permissions);
        return callback(null);
      }
    }
  });

  // Specialized schema field type just for the people/group
  // relationship. The field name is ignored and it works
  // exactly as it did before we had it as a field type. We
  // refactored this way so that grouping the people control
  // into a tab would be possible.

  schemas.addFieldType({
    name: 'a2People',
    render: function(data) {
      return self.render('peopleField', data);
    },
    converters: {
      form: function(req, data, name, snippet, field, callback) {
        // Let afterSave do it, because we don't have an id yet
        // if we're a new group.
        return callback(null);
      },

      csv: function(req, data, name, snippet, field, callback) {
        // No CSV import of group memberships for now
        return callback(null);
      }
    }
  });

  self._peopleSortable = options.peopleSortable;

  self._peopleType = options.peopleType;

  options.removeFields = [ 'hideTitle' ].concat(options.removeFields);
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
  // ourselves after adding methods
  snippets.Snippets.call(this, options, null);

  var superPushAllAssets = self.pushAllAssets;

  self.pushAllAssets = function() {
    var permissions;
    if (options.permissions) {
      permissions = options.permissions;
    } else {
      // Base permissions list
      permissions = [ { value: 'guest', label: 'Guest' }, { value: 'edit', label: 'Editor' }, { value: 'admin', label: 'Admin: All' }, { value: 'admin-file', label: 'Admin: Files' }, { value: 'edit-file', label: 'Edit: Files' } ];
      // Type-specific admin permissions
      var instanceTypes = self._pages.getAllInstanceTypeNames();
      _.each(instanceTypes, function(type) {
        if (!self._pages.getManager(type)._adminOnly) {
          permissions.push({
            value: 'admin-' + self._apos.cssName(type),
            label: 'Admin: ' + self._pages.getManager(type).pluralLabel
          });
          permissions.push({
            value: 'edit-' + self._apos.cssName(type),
            label: 'Edit: ' + self._pages.getManager(type).pluralLabel
          });
          permissions.push({
            value: 'submit-' + self._apos.cssName(type),
            label: 'Submit: ' + self._pages.getManager(type).pluralLabel
          });
        }
      });
      // event allowing permissions list to be extended
      self._apos.emit('permissions', permissions);
    }

    // Make sure the permissions list is visible to our asset templates and to browser-side JS
    extend(true, self._rendererGlobals, {
      type: {
        permissions: permissions
      }
    });

    self._apos.pushGlobalData({
      'aposGroups': {
        permissions: permissions
      }
    });

    self._permissions = permissions;

    // Now we can push the template assets that are rendered with the
    // permissions list via rendererGlobals
    return superPushAllAssets();
  };

  // Join groups with their people if not explicitly turned off
  var superGet = self.get;
  self.get = function(req, criteria, options, callback) {
    var getPeople = true;
    if (options.getPeople === false) {
      getPeople = false;
    }
    if ((options.groupIds && options.groupIds.length) || (options.notGroupIds && options.notGroupIds.length)) {
      var $and = [];
      if (options.groupIds && options.groupIds.length) {
        $and.push({ _id: { $in: options.groupIds } });
      }
      if (options.notGroupIds && options.notGroupIds.length) {
        $and.push({ _id: { $nin: options.notGroupIds } });
      }
      $and.push(criteria);
      criteria = { $and: $and };
    }

    return superGet.call(self, req, criteria, options, function(err, results) {
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
        var getOptions = {
          getGroups: false,
          permalink: options.permalink
        };
        if (self._peopleSortable && (snippets.length === 1))  {
          var sortByString = "groupExtras." + snippets[0]._id + ".rank";
          getOptions.sort = {};
          getOptions.sort[sortByString] = 1;
        }
        // We want to permalink to the same directory page, if any
        return self._apos.joinByArrayReverse(req, snippets, 'groupIds', undefined, '_people', { get: self.getPeopleManager().get, getOptions: getOptions }, function(err) {
          if (err) {
            return callback(err);
          }

          return callback(null, results);
        });
      }
    });
  };

  self.afterSave = function(req, data, snippet, callback) {
    // The person-group relationship is actually stored in arrays in
    // the person objects. Arrays of IDs are a good choice because
    // they can be indexed. Blast them with $addToSet and $in, and
    // conversely, $pull and $nin.

    var personIds = _.map(data._peopleInfo || [], function(personInfo) {
      return self._apos.sanitizeString(personInfo.value || personInfo);
    });
    async.series([addId, addExtras, removeId, removeExtras], callback);

    function addId(callback) {
      return self._apos.pages.update({ _id: { $in: personIds } }, { $addToSet: { groupIds: snippet._id } }, { multi: true }, callback);
    }

    function removeId(callback) {
      return self._apos.pages.update({ type: self.getPeopleInstance(), _id: { $nin: personIds } }, { $pull: { groupIds: snippet._id } }, { multi: true }, callback);
    }

    // Extras like job titles are stored in an object property
    // for each person:
    //
    // { title: 'Bob Smith', groupExtras: { someGroupId: { jobTitle: 'Flosser' } } }

    function addExtras(callback) {
      var n = 0;
      async.eachSeries(data._peopleInfo || [], function(personInfo, callback) {
        var set = { $set: { } };
        var extras = { };
        // Clone the object so we can modify it
        extend(true, extras, personInfo);
        // We're setting the rank.
        if (self._peopleSortable) {
          extras.rank = n;
        }
        // Do not redundantly store the ID
        delete extras.value;
        set.$set['groupExtras.' + snippet._id] = extras;
        n++; //We're incrementing our counter for sort order
        return self._apos.pages.update({ _id: personInfo.value }, set, callback);
      }, callback);
    }

    function removeExtras(callback) {
      var unset = { $unset: { } };
      unset.$unset['groupExtras.' + snippet._id] = 1;
      return self._apos.pages.update({ type: self.getPeopleInstance(), _id: { $nin: personIds } }, unset, callback);
    }
  };

  // Allow a directory page to be locked down by group
  var superAddCriteria = self.addCriteria;
  self.addCriteria = function(req, criteria, options) {
    superAddCriteria.call(self, req, criteria, options);
    options.groupIds = req.page.groupIds;
    options.notGroupIds = req.page.notGroupIds;
  };

  // Adjust the best page matching algorithm to look at the groupIds property
  // rather than tags, and tell it that we're comparing against the id of the
  // snippet rather than an array property on the snippet

  self.bestPageMatchingProperty = 'groupIds';
  self.bestPageById = true;

  self.permalink = function(req, snippet, page, callback) {
    // If a directory page is locked to a single group, we can skip an ugly extra
    // directory level
    if (page.groupIds && (page.groupIds.length === 1) && (page.groupIds[0] === snippet._id)) {
      snippet.url = page.slug;
    } else {
      snippet.url = page.slug + '/' + snippet.slug;
    }
    return callback(null);
  };

  // Returns either 'people' or 'groups', as determined by the style picker
  // in page settings.

  self.getDefaultView = function(req) {
    var settings = req.bestPage;
    if (settings && settings.groupIds.length === 1) {
      // If the page is locked down to only one group it doesn't
      // make sense to show an index of groups. We should already
      // know what group it is from context. TODO: it would be
      // nice if you could see this was going to happen when you
      // picked just one group in page settings.
      return 'people';
    }
    if (req.bestPage.defaultView) {
      return req.bestPage.defaultView;
    }
    return 'groups';
  };

  // Override the dispatcher. The default one isn't much use for our
  // needs because we are displaying both groups and people and we don't
  // want conventional pagination (although we may need to implement
  // A-Z pagination and possibly conventional pagination within that)

  self.dispatch = function(req, callback) {

    var defaultView = self.getDefaultView(req);

    if (!req.remainder.length) {
      // The default behavior depends on the default view selector
      // in page settings.
      if (defaultView === 'people') {
        return self.indexPeople(req, callback);
      } else {
        return self.indexGroups(req, callback);
      }
    }

    // If the URL is /people show the people index; however, if the
    // default view is people, redirect to shorten the URL
    if (req.remainder.match(/^\/people$/)) {
      if (defaultView === 'people') {
        // Careful don't fail to match because of a query string
        req.redirect = req.url.replace(/\/people(\?|$)/, '$1');
        return callback(null);
      }
      return self.indexPeople(req, callback);
    }

    // If the URL is /groups show the groups index; however, if the
    // default view is groups, redirect to shorten the URL
    if (req.remainder.match(/^\/groups$/)) {
      if (defaultView === 'groups') {
        req.redirect = req.url.replace(/\/groups$/, '');
        return callback(null);
      }
      return self.indexGroups(req, callback);
    }

    // The URL is either a person or a group. But which one?
    // Good question, so let's use a fast Mongo query to find out,
    // then call the appropriate 'show' method which will
    // fetch it properly with permissions and custom features of
    // that type of snippet taken into account

    // Skip the slash. The rest is a slug
    var slug = req.remainder.substr(1);
    var type;
    return self._apos.pages.findOne({ slug: slug }, { type: 1, _id: 1 }, function(err, snippet) {
      if (err) {
        return callback(err);
      }
      if (!snippet) {
        req.notfound = true;
        return callback(null);
      }
      type = snippet.type;

      if (type === self.getPeopleInstance()) {
        return self.showPerson(req, slug, callback);
      }

      if (type === 'group') {
        return self.showGroup(req, slug, callback);
      }

      // Some other type of snippet, not relevant here
      req.notfound = true;
      return callback(null);
    });
  };

  self.showPerson = function(req, slug, callback) {
    return self.getPeopleManager().getOne(req, { slug: slug }, { permalink: req.bestPage }, function(err, person) {
      if (err) {
        return callback(err);
      }
      req.extras.person = person;
      if (!req.extras.person) {
        req.notfound = true;
        return callback(null);
      }
      req.template = self.renderer('showPerson');
      return self.beforeShowPerson(req, person, callback);
    });
  };

  self.beforeShowPerson = function(req, person, callback) {
    return callback(null);
  };

  self.indexPeople = function(req, callback) {
    var criteria = {};
    var settings = req.bestPage;
    if (settings && settings.groupIds && settings.groupIds.length) {
      if (settings.groupIds.length === 1) {
        req.extras.oneGroup = true;
      }
    }

    var options = {};

    if (settings.groupIds && settings.groupIds.length) {
      options.groupIds = settings.groupIds;
    }
    if (settings.notGroupIds && settings.notGroupIds.length) {
      options.notGroupIds = settings.notGroupIds;
    }

    if (req.query.letter) {
      options.letter = req.query.letter;
      req.extras.letter = req.query.letter;
    }

    if (req.query.tags) {
      options.tags = req.query.tags;
      req.extras.tags = req.query.tags;
    }

    options.search = req.query.search || req.query.q;

    if (req.query.autocomplete) {
      options.autocomplete = req.query.autocomplete;
    }

    if (self._peopleSortable && settings.groupIds  && (settings.groupIds.length === 1))  {
      var sortByString = "groupExtras." + settings.groupIds[0] + ".rank";
      options.sort = {};
      options.sort[sortByString] = 1;
    }

    self.afterIndexPeopleCriteria(req, criteria, options);

    self.addPager(req, options);
    options.permalink = req.bestPage;
    return self.getPeopleManager().get(req, criteria, options, function(err, results) {
      if (err) {
        return callback(err);
      }
      req.extras.total = results.total;
      self.setPagerTotal(req, results.total);
      req.extras.people = results.snippets;
      if ((req.xhr || req.query.xhr) && (!req.query.apos_refresh) && (!req.query.pageInformation)) {
        if (!results.snippets.length) {
          // So bottomless stops loading pages in infinite scroll
          req.notfound = true;
          return callback(null);
        } else {
          req.template = self.renderer('indexPeopleAjax');
        }
      } else {
        req.template = self.renderer('indexPeople');
      }
      return callback(null);
    });
  };

  // A last chance to adjust the criteria and options to be passed to
  // self.get by indexPeople
  self.afterIndexPeopleCriteria = function(req, criteria, options) {
  };

  self.indexGroups = function(req, callback) {
    // List of groups. The template can see groups
    var criteria = {};
    var settings = req.bestPage;
    if (settings && settings.groupIds && settings.groupIds.length) {
      criteria._id = { $in: settings.groupIds };
    }
    var options = { permalink: req.bestPage };

    if (settings.groupIds && settings.groupIds.length) {
      options.groupIds = settings.groupIds;
    }
    if (settings.notGroupIds && settings.notGroupIds.length) {
      options.notGroupIds = settings.notGroupIds;
    }

    return self.get(req, criteria, options, function(err, results) {
      if (err) {
        return callback(err);
      }
      req.extras.groups = results.snippets;
      req.template = self.renderer('indexGroups');
      return callback(null);
    });
  };

  self.showGroup = function(req, slug, callback) {
    // A specific group
    return self.getOne(req, { slug: slug }, { permalink: req.bestPage }, function(err, group) {
      if (err) {
        return callback(err);
      }
      req.extras.group = group;
      if (!req.extras.group) {
        req.notfound = true;
      }
      req.template = self.renderer('showGroup');
      return callback(null);
    });
  };

  self.getPeopleManager = function() {
    return self._pages.getType(self._peopleType);
  };

  self.getPeopleInstance = function() {
    return self.getPeopleManager()._instance;
  };

  self._apos.tasks['generate-users-and-groups'] = function(callback) {
    var req = self._apos.getTaskReq();
    var randomWords = require('random-words');
    var groups = [];
    async.series([ makeGroups, makeUsers ], callback);
    function makeGroups(callback) {
      var i = 0;
      return addGroupUntil();
      function addGroupUntil() {
        var title = randomWords({ min: 1, max: 2, join: ' ' });
        var group = {
          type: 'group',
          title: title,
          slug: self._apos.slugify(title),
          testData: true,
          // Most but not all groups will be published
          published: Math.random() > 0.8,
          body: {
            type: 'area',
            items: [
              {
                type: 'richText',
                content: randomWords({ min: 50, max: 200, join: ' ' })
              }
            ]
          }
        };
        // Insert the pages properly so we don't have
        // issues with searchability
        return self._apos.putPage(req, group.slug, group, function(err) {
          if (err) {
            return callback(err);
          }
          groups.push(group);
          i++;
          if (i < 20) {
            return addGroupUntil();
          } else {
            return callback(null);
          }
        });
      }
    }
    function makeUsers(callback) {
      var i = 0;
      var people = [];
      return addPersonUntil();
      function addPersonUntil() {
        var j;
        var firstName = randomWords();
        var lastName = randomWords();
        var title = firstName + ' ' + lastName;
        var groupIds = [];
        // Arrange things so that we get some people with no group,
        // many people with one or more of the first three groups, and
        // a decent number of people with a smattering of the other
        // groups. This is reasonably analogous to how things
        // typically look in production
        if (Math.random() < 0.2) {
          // No groups for this person
        } else {
          for (j = 0; (j < 3); j++) {
            if (Math.random() < 0.5) {
              groupIds.push(groups[j]._id);
            }
          }
          if (Math.random() > 0.5) {
            for (j = 3; (j < groups.length); j++) {
              if (Math.random() < (1.0 / groups.length)) {
                groupIds.push(groups[j]._id);
              }
            }
          }
        }
        var person = {
          type: self._peopleType,
          title: title,
          firstName: firstName,
          lastName: lastName,
          slug: self._apos.slugify(title),
          groupIds: groupIds,
          testData: true,
          body: {
            type: 'area',
            items: [
              {
                type: 'richText',
                content: randomWords({ min: 50, max: 200, join: ' ' })
              }
            ]
          }
        };
        if (Math.random() > 0.25) {
          // 3/4 are published
          person.published = true;
        }
        if (Math.random() > 0.5) {
          // 1/2 can log in
          person.login = true;
          person.username = person.slug;
          var _password = randomWords({ exactly: 5, join: ' ' });
          person.password = self._apos.hashPassword(_password);
        }
        // Insert the pages properly so we don't have
        // issues with searchability
        return self._apos.putPage(req, person.slug, person, function(err) {
          if (err) {
            return callback(err);
          }
          people.push(person);
          i++;
          if (i < 400) {
            return addPersonUntil();
          } else {
            return callback(null);
          }
        });
      }
    }
  };

  // Ensure that a group with the specified name exists. If it
  // does not already exist, it is created with the specified
  // permissions. The permissions of an existing group are
  // NOT changed. Invokes the callback with (err, group)

  self.ensureExists = function(req, name, permissions, callback) {
    return self.getOne(req, { title: name }, { permissions: false }, function(err, group) {
      if (err) {
        return callback(err);
      }
      if (group) {
        return callback(null, group);
      }
      group = {
        title: name,
        permissions: permissions || []
      };
      return self.putOne(req, { permissions: false }, group, function(err) {
        if (err) {
          return callback(err);
        }
        return callback(null, group);
      });
    });
  };

  if (callback) {
    // Invoke callback on next tick so that the groups object
    // is returned first and can be assigned to a variable for
    // use in whatever our callback is invoking
    process.nextTick(function() { return callback(null); });
  }
};
