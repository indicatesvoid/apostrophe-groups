// JavaScript which enables editing of this module's content belongs here.

function AposGroups(optionsArg) {
  var self = this;
  var options = {
    instance: 'group',
    name: 'groups'
  };
  $.extend(options, optionsArg);
  AposSnippets.call(self, options);

  // PAGE SETTINGS FOR THIS TYPE

  self.settings = {
    serialize: function($el, $details) {
      var data = {
        groupIds: $details.find('[data-name="typeSettings[groupIds]"]').selective('get'),
        notGroupIds: $details.find('[data-name="typeSettings[notGroupIds]"]').selective('get'),
        defaultView: $details.findByName('typeSettings[defaultView]').val(),
        showThumbnail: $details.findByName('typeSettings[showThumbnail]').val()
      };
      return data;
    },
    unserialize: function(data, $el, $details) {
      $details.find('[data-name="typeSettings[groupIds]"]').selective({
        source: self._action + '/autocomplete',
        data: data.groupIds || []
      });
      $details.find('[data-name="typeSettings[notGroupIds]"]').selective({
        source: self._action + '/autocomplete',
        data: data.notGroupIds || []
      });
      $details.findByName('typeSettings[defaultView]').val(data.defaultView || 'groups');
      $details.findByName('typeSettings[showThumbnail]').val(data.showThumbnail ? '1' : '0');
    }
  };

  self.beforeSave = function($el, data, callback) {
    data._peopleInfo = $el.find('[data-name="people"]').selective('get');
    _.each(apos.data.aposGroups.permissions, function(permission) {
      data[permission.value] = $el.findByName(permission.value).val();
    });
    return callback();
  };

  self.afterPopulatingEditor = function($el, snippet, callback) {
    $el.findByName('permissions').val(apos.tagsToString(snippet.permissions));
    $el.find('[data-name="people"]').selective({
      sortable: options.peopleSortable,
      extras: true,
      source: aposPages.getType('people')._action + '/autocomplete',
      data: _.map(snippet._people || [], function(person) {
        var data = { label: person.title, value: person._id };
        if (person.groupExtras && person.groupExtras[snippet._id]) {
          $.extend(true, data, person.groupExtras[snippet._id]);
        }
        return data;
      })
    });
    _.each(apos.data.aposGroups.permissions, function(permission) {
      $el.findByName(permission.value).val(_.contains(snippet.permissions || [], permission.value) ? '1' : '0');
    });
    return callback();
  };

  self.addingToManager = function($el, $snippet, snippet) {
    $snippet.find('[data-published]').val(snippet.published ? 'Yes' : 'No');
  };
}

AposGroups.addWidgetType = function(options) {
  if (!options) {
    options = {};
  }
  _.defaults(options, {
    name: 'groups',
    label: 'Groups',
    action: '/apos-groups',
    defaultLimit: 5
  });
  AposSnippets.addWidgetType(options);
};

